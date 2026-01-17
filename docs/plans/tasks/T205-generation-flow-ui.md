# T205: Generation Flow UI Implementation

## 基本情報
- **タスクID**: T205
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**:
  - T203 (Authentication UI)
  - T204 (Camera & Gallery Integration)
  - T107 (Cloud Run Deployment - Backend API)
- **成果物**:
  - `components/AspectRatioSelector.tsx`
  - `components/GenerationProgress.tsx`
  - `services/api/client.ts`
  - `services/api/generation.ts`
  - `hooks/useGeneration.ts`
  - `app/(tabs)/home.tsx` (更新: 生成フロー追加)
  - `constants/config.ts`
- **推定時間**: 4-5時間

## 概要
アスペクト比選択UI、生成進行状況表示、Backend API統合を実装し、ユーザーが写真を選択してAI生成を実行できる完全なフローを構築します。Firebase ID Tokenを使用した認証付きAPI呼び出しとエラーハンドリングを実装します。

## 前提条件
- [ ] T203が完了している (AuthContext実装済み)
- [ ] T204が完了している (画像選択機能実装済み)
- [ ] T107が完了している (Backend APIデプロイ済み)
- [ ] Backend APIのURL が取得済み

## 実装手順

### Step 1: 設定ファイルの作成

`constants/config.ts` を作成:

```typescript
export const CONFIG = {
  // Backend API URL (T107で取得したCloud Run URL)
  API_BASE_URL: 'https://bananadish-api-XXXXXX.run.app',

  // APIタイムアウト
  API_TIMEOUT: 45000, // 45秒

  // 画像制限
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MIN_IMAGE_WIDTH: 640,
  MIN_IMAGE_HEIGHT: 480,
};

export const ASPECT_RATIOS = [
  { value: '4:5', label: 'Instagram (4:5)', dimensions: '1080 x 1350' },
  { value: '9:16', label: 'ストーリー (9:16)', dimensions: '1080 x 1920' },
  { value: '16:9', label: 'YouTube (16:9)', dimensions: '1920 x 1080' },
  { value: '1:1', label: '正方形 (1:1)', dimensions: '1080 x 1080' },
] as const;

export type AspectRatioValue = typeof ASPECT_RATIOS[number]['value'];

export const STYLES = [
  { value: 'natural', label: '自然', emoji: '🌿' },
  { value: 'bright', label: '明るい', emoji: '☀️' },
  { value: 'moody', label: 'ムーディー', emoji: '🌙' },
] as const;

export type StyleValue = typeof STYLES[number]['value'];
```

### Step 2: API Clientの実装

`services/api/client.ts` を作成:

```typescript
import { CONFIG } from '@/constants/config';

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string, timeout: number = CONFIG.API_TIMEOUT) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { idToken?: string } = {}
  ): Promise<T> {
    const { idToken, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: HeadersInit = {
        ...fetchOptions.headers,
      };

      // Firebase ID Tokenを付与
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          code: errorData.error?.code || 'UNKNOWN_ERROR',
          message: errorData.error?.message || 'エラーが発生しました',
          retryable: errorData.error?.retryable || false,
        } as ApiError;
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw {
          code: 'TIMEOUT',
          message: 'リクエストがタイムアウトしました',
          retryable: true,
        } as ApiError;
      }

      if (error.code) {
        throw error as ApiError;
      }

      throw {
        code: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました',
        retryable: true,
      } as ApiError;
    }
  }
}

export const apiClient = new ApiClient(CONFIG.API_BASE_URL);
```

### Step 3: Generation API Serviceの実装

`services/api/generation.ts` を作成:

```typescript
import { apiClient, ApiError } from './client';
import { AspectRatioValue, StyleValue } from '@/constants/config';

export interface GenerateRequest {
  imageUri: string;
  aspect: AspectRatioValue;
  style?: StyleValue;
  idToken: string;
}

export interface GeneratedImage {
  mime: string;
  b64: string;
}

export interface GenerateResponse {
  aspect: string;
  count: number;
  images: GeneratedImage[];
  usage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

/**
 * POST /v1/generate
 * 画像生成APIを呼び出す
 */
export const generateImages = async ({
  imageUri,
  aspect,
  style = 'natural',
  idToken,
}: GenerateRequest): Promise<GenerateResponse> => {
  // FormDataの作成
  const formData = new FormData();

  // 画像ファイルをFormDataに追加
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  formData.append('aspect', aspect);
  formData.append('style', style);

  return apiClient.request<GenerateResponse>('/v1/generate', {
    method: 'POST',
    body: formData,
    idToken,
  });
};

/**
 * GET /v1/subscription/status
 * サブスクリプション状態と使用状況を取得
 */
export const getSubscriptionStatus = async (idToken: string) => {
  return apiClient.request('/v1/subscription/status', {
    method: 'GET',
    idToken,
  });
};
```

### Step 4: AspectRatioSelector コンポーネントの実装

`components/AspectRatioSelector.tsx` を作成:

```typescript
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ASPECT_RATIOS, AspectRatioValue } from '@/constants/config';

interface AspectRatioSelectorProps {
  selected: AspectRatioValue;
  onSelect: (ratio: AspectRatioValue) => void;
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>アスペクト比</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.optionsContainer}>
          {ASPECT_RATIOS.map(ratio => (
            <TouchableOpacity
              key={ratio.value}
              style={[
                styles.option,
                selected === ratio.value && styles.optionSelected,
              ]}
              onPress={() => onSelect(ratio.value)}
            >
              <View
                style={[
                  styles.ratioPreview,
                  getRatioPreviewStyle(ratio.value),
                  selected === ratio.value && styles.ratioPreviewSelected,
                ]}
              />
              <Text
                style={[
                  styles.optionLabel,
                  selected === ratio.value && styles.optionLabelSelected,
                ]}
              >
                {ratio.label}
              </Text>
              <Text style={styles.optionDimensions}>{ratio.dimensions}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// アスペクト比のプレビュー形状を計算
const getRatioPreviewStyle = (ratio: AspectRatioValue) => {
  const baseSize = 60;
  switch (ratio) {
    case '4:5':
      return { width: baseSize * 0.8, height: baseSize };
    case '9:16':
      return { width: baseSize * 0.56, height: baseSize };
    case '16:9':
      return { width: baseSize, height: baseSize * 0.56 };
    case '1:1':
      return { width: baseSize, height: baseSize };
  }
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E5F1FF',
  },
  ratioPreview: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  ratioPreviewSelected: {
    backgroundColor: '#007AFF',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#007AFF',
  },
  optionDimensions: {
    fontSize: 10,
    color: '#999',
  },
});
```

### Step 5: GenerationProgress コンポーネントの実装

`components/GenerationProgress.tsx` を作成:

```typescript
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';

interface GenerationProgressProps {
  visible: boolean;
  message?: string;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  visible,
  message = 'AIが4枚の素敵な写真を生成中...',
}) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.subMessage}>最大30秒ほどかかります</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  subMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
```

### Step 6: useGeneration カスタムフックの実装

`hooks/useGeneration.ts` を作成:

```typescript
import { useState } from 'react';
import { Alert } from 'react-native';
import { generateImages, GeneratedImage } from '@/services/api/generation';
import { useAuth } from './useAuth';
import { AspectRatioValue, StyleValue } from '@/constants/config';

interface GenerationState {
  loading: boolean;
  images: GeneratedImage[];
  error: string | null;
  usage: {
    used: number;
    limit: number;
    remaining: number;
  } | null;
}

export const useGeneration = () => {
  const { idToken, refreshIdToken } = useAuth();
  const [state, setState] = useState<GenerationState>({
    loading: false,
    images: [],
    error: null,
    usage: null,
  });

  const generate = async (imageUri: string, aspect: AspectRatioValue, style: StyleValue = 'natural') => {
    if (!idToken) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // ID Tokenをリフレッシュ（期限切れ対策）
      const freshToken = await refreshIdToken();

      const response = await generateImages({
        imageUri,
        aspect,
        style,
        idToken: freshToken,
      });

      setState({
        loading: false,
        images: response.images,
        error: null,
        usage: response.usage,
      });

      return response.images;
    } catch (error: any) {
      let errorMessage = 'エラーが発生しました';

      if (error.code === 'QUOTA_EXCEEDED') {
        errorMessage = '今月の生成回数が上限に達しました。プランをアップグレードしてください。';
        // ここでサブスクリプション画面への遷移を促すモーダルを表示
      } else if (error.code === 'UNAUTHORIZED') {
        errorMessage = '認証エラーが発生しました。再度ログインしてください。';
      } else if (error.code === 'TIMEOUT') {
        errorMessage = 'リクエストがタイムアウトしました。もう一度お試しください。';
      } else if (error.code === 'AI_GENERATION_FAILED') {
        errorMessage = 'AI生成に失敗しました。別の写真で試してください。';
      } else {
        errorMessage = error.message || 'エラーが発生しました';
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      Alert.alert('生成失敗', errorMessage);
    }
  };

  const reset = () => {
    setState({
      loading: false,
      images: [],
      error: null,
      usage: null,
    });
  };

  return {
    ...state,
    generate,
    reset,
  };
};
```

### Step 7: Home画面の更新（生成フロー統合）

`app/(tabs)/home.tsx` を更新:

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMediaPermissions } from '@/hooks/useMediaPermissions';
import { useGeneration } from '@/hooks/useGeneration';
import { AspectRatioSelector } from '@/components/AspectRatioSelector';
import { GenerationProgress } from '@/components/GenerationProgress';
import { AspectRatioValue } from '@/constants/config';

export default function HomeScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedAspect, setSelectedAspect] = useState<AspectRatioValue>('4:5');
  const [photoLoading, setPhotoLoading] = useState(false);

  const { permissions, requestCameraPermission, requestMediaLibraryPermission } =
    useMediaPermissions();

  const { loading: generating, usage, generate, reset } = useGeneration();

  const handleTakePhoto = async () => {
    const hasPermission = permissions.camera || (await requestCameraPermission());
    if (!hasPermission) return;

    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('エラー', 'カメラの起動に失敗しました');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    const hasPermission =
      permissions.mediaLibrary || (await requestMediaLibraryPermission());
    if (!hasPermission) return;

    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          Alert.alert('エラー', '画像サイズが10MBを超えています');
          return;
        }

        if (asset.width < 640 || asset.height < 480) {
          Alert.alert('エラー', '画像の解像度が低すぎます (最小: 640x480px)');
          return;
        }

        setSelectedImage(asset.uri);
      }
    } catch (error) {
      Alert.alert('エラー', 'フォトライブラリの起動に失敗しました');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      Alert.alert('エラー', '画像を選択してください');
      return;
    }

    const images = await generate(selectedImage, selectedAspect);

    if (images && images.length === 4) {
      // T206で実装: 結果画面へ遷移
      console.log('Generation successful! 4 images received.');
      Alert.alert('成功', '4枚の画像が生成されました！ (T206で結果画面を実装)');
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    reset();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BananaDish</Text>
        <Text style={styles.subtitle}>料理写真をプロ級に変換</Text>
        {usage && (
          <Text style={styles.usage}>
            今月の残り: {usage.remaining} / {usage.limit} 回
          </Text>
        )}
      </View>

      {/* 画像プレビュー */}
      <View style={styles.imageContainer}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage }} style={styles.image} resizeMode="contain" />
            <TouchableOpacity style={styles.clearButton} onPress={handleClearImage}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={80} color="#ccc" />
            <Text style={styles.placeholderText}>写真を選択してください</Text>
          </View>
        )}
      </View>

      {/* カメラ/ギャラリーボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cameraButton]}
          onPress={handleTakePhoto}
          disabled={photoLoading || generating}
        >
          {photoLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.buttonText}>写真を撮る</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.galleryButton]}
          onPress={handleChooseFromLibrary}
          disabled={photoLoading || generating}
        >
          {photoLoading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <>
              <Ionicons name="images" size={24} color="#007AFF" />
              <Text style={[styles.buttonText, styles.galleryButtonText]}>ライブラリ</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* アスペクト比選択 */}
      {selectedImage && (
        <AspectRatioSelector selected={selectedAspect} onSelect={setSelectedAspect} />
      )}

      {/* 生成ボタン */}
      {selectedImage && (
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Text style={styles.generateButtonText}>
            {generating ? '生成中...' : 'AI生成 (4枚)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 生成進行状況モーダル */}
      <GenerationProgress visible={generating} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  usage: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  galleryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  galleryButtonText: {
    color: '#007AFF',
  },
  generateButton: {
    backgroundColor: '#34C759',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
```

## 完了条件（DoD）

- [ ] AspectRatioSelectorコンポーネントが実装されている
- [ ] GenerationProgressコンポーネントが実装されている
- [ ] API Client が実装されている
- [ ] Generation API統合が動作する
- [ ] Firebase ID Tokenが正しく送信される
- [ ] アスペクト比選択が動作する
- [ ] 生成ボタンで API呼び出しが実行される
- [ ] 生成中にプログレス表示が出る
- [ ] 4枚の画像が返却される
- [ ] エラーハンドリングが動作する (QUOTA_EXCEEDED等)
- [ ] 使用状況 (remaining) が表示される

## 検証手順

**前提**: T107でBackend APIがデプロイ済み

```bash
cd bananadish-app

# constants/config.ts のAPI_BASE_URLを実際のCloud Run URLに更新

# アプリ起動
npm run ios
```

**手動テスト**:

1. **画像選択 → アスペクト比選択**:
   - ギャラリーから画像を選択
   - アスペクト比オプションが表示される
   - 各オプションをタップして選択できる → ✓

2. **AI生成実行**:
   - 「AI生成 (4枚)」をタップ
   - プログレスモーダルが表示される
   - Backend APIリクエストが送信される
   - 4枚の画像が返却される (Consoleログで確認)
   - 成功アラートが表示される → ✓

3. **エラーハンドリング**:
   - Backend APIを停止して生成実行 → ネットワークエラー表示 → ✓
   - Firestoreで usage.currentPeriodUsed を limit と同じ値に設定 → QUOTA_EXCEEDED エラー → ✓

4. **ID Token送信確認**:
   - Backend APIのログでAuthorizationヘッダーを確認
   - `Bearer eyJhbGciOiJSUzI1NiIsImtpZCI...` 形式のトークンが送信されている → ✓

## トラブルシューティング

### 問題: API呼び出しでUNAUTHORIZEDエラー

**解決策**:
```typescript
// ID Tokenが正しく取得できているか確認
const { idToken } = useAuth();
console.log('ID Token:', idToken);

// Token期限切れの可能性 → refreshIdToken()を実行
```

### 問題: FormDataが送信されない

**症状**: Backend APIで `req.file` が undefined

**解決策**:
```typescript
// fetch の Content-Type を手動設定しない（FormDataが自動設定）
// NG: headers: { 'Content-Type': 'multipart/form-data' }
// OK: headers に Content-Type を含めない
```

### 問題: TIMEOUTエラー

**解決策**:
```typescript
// CONFIG.API_TIMEOUT を60000 (60秒) に延長
export const CONFIG = {
  API_TIMEOUT: 60000,
};
```

## Deliverables

- アスペクト比選択UI (4種類)
- 生成プログレス表示
- Backend API統合 (POST /v1/generate)
- エラーハンドリング (QUOTA_EXCEEDED, TIMEOUT等)
- 使用状況表示

## Notes

- **API URL**: constants/config.ts で環境に応じて切り替え
- **Timeout**: 45秒に設定 (Backend処理30秒 + バッファ)
- **次のステップ**: T206で生成結果の表示と保存を実装

## 関連ドキュメント

- [技術設計書 - API Endpoints](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#api-endpoints-specification)
- [実装計画書 - T205](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t205-generation-flow-ui-implementation)
