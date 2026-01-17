# T204: Camera & Gallery Integration

## 基本情報
- **タスクID**: T204
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**: T202 (Navigation & Routing)
- **成果物**:
  - `hooks/useMediaPermissions.ts`
  - `app/(tabs)/home.tsx` (更新: カメラ/ギャラリー機能追加)
  - パーミッション処理ロジック
- **推定時間**: 2-3時間

## 概要
expo-image-pickerを使用して、カメラからの写真撮影とフォトライブラリからの写真選択機能を実装します。パーミッション処理を適切に行い、ユーザーフレンドリーなエラーハンドリングを実装します。

## 前提条件
- [ ] T201が完了している (Expoプロジェクト作成済み)
- [ ] T202が完了している (ナビゲーション実装済み)
- [ ] `expo-image-picker` がインストール済み
- [ ] `app.json` にパーミッション設定が記述済み

## 実装手順

### Step 1: useMediaPermissions カスタムフックの実装

`hooks/useMediaPermissions.ts` を作成:

```typescript
import { useState, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface MediaPermissions {
  camera: boolean;
  mediaLibrary: boolean;
}

export interface UseMediaPermissionsReturn {
  permissions: MediaPermissions;
  requestCameraPermission: () => Promise<boolean>;
  requestMediaLibraryPermission: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
}

export const useMediaPermissions = (): UseMediaPermissionsReturn => {
  const [permissions, setPermissions] = useState<MediaPermissions>({
    camera: false,
    mediaLibrary: false,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
    const mediaLibraryStatus = await ImagePicker.getMediaLibraryPermissionsAsync();

    setPermissions({
      camera: cameraStatus.status === 'granted',
      mediaLibrary: mediaLibraryStatus.status === 'granted',
    });
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status === 'granted') {
      setPermissions(prev => ({ ...prev, camera: true }));
      return true;
    }

    if (status === 'denied') {
      Alert.alert(
        'カメラへのアクセスが必要です',
        '写真を撮影するには、カメラへのアクセスを許可してください。設定から変更できます。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '設定を開く',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
    }

    return false;
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status === 'granted') {
      setPermissions(prev => ({ ...prev, mediaLibrary: true }));
      return true;
    }

    if (status === 'denied') {
      Alert.alert(
        'フォトライブラリへのアクセスが必要です',
        '写真を選択するには、フォトライブラリへのアクセスを許可してください。設定から変更できます。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '設定を開く',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
    }

    return false;
  };

  return {
    permissions,
    requestCameraPermission,
    requestMediaLibraryPermission,
    checkPermissions,
  };
};
```

### Step 2: Home画面の更新（カメラ/ギャラリー統合）

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
import { useMediaPermissions } from '@/hooks/useMediaPermissions';

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    permissions,
    requestCameraPermission,
    requestMediaLibraryPermission,
  } = useMediaPermissions();

  const handleTakePhoto = async () => {
    // パーミッションチェック
    const hasPermission = permissions.camera || (await requestCameraPermission());
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1, // 最高品質
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('エラー', 'カメラの起動に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseFromLibrary = async () => {
    // パーミッションチェック
    const hasPermission =
      permissions.mediaLibrary || (await requestMediaLibraryPermission());
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        // ファイルサイズチェック (10MB制限)
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          Alert.alert('エラー', '画像サイズが10MBを超えています。別の画像を選択してください。');
          return;
        }

        // 最小解像度チェック (640x480)
        if (asset.width < 640 || asset.height < 480) {
          Alert.alert(
            'エラー',
            '画像の解像度が低すぎます。640x480px以上の画像を選択してください。'
          );
          return;
        }

        setSelectedImage(asset.uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('エラー', 'フォトライブラリの起動に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BananaDish</Text>
        <Text style={styles.subtitle}>料理写真をプロ級に変換</Text>
      </View>

      {/* 画像プレビューエリア */}
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
          disabled={loading}
        >
          {loading ? (
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
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <>
              <Ionicons name="images" size={24} color="#007AFF" />
              <Text style={[styles.buttonText, styles.galleryButtonText]}>ライブラリから選択</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 次へボタン (T205で実装) */}
      {selectedImage && (
        <TouchableOpacity style={styles.nextButton} disabled>
          <Text style={styles.nextButtonText}>次へ (T205で実装)</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.infoText}>
        {permissions.camera ? '✓' : '✗'} カメラ権限{'\n'}
        {permissions.mediaLibrary ? '✓' : '✗'} フォトライブラリ権限
      </Text>
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
  nextButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
```

## 完了条件（DoD）

- [ ] カメラ起動ボタンが動作する
- [ ] フォトライブラリ選択ボタンが動作する
- [ ] 選択した画像がプレビュー表示される
- [ ] カメラパーミッションが正しくリクエストされる
- [ ] フォトライブラリパーミッションが正しくリクエストされる
- [ ] パーミッション拒否時に設定画面へのリンクが表示される
- [ ] 画像サイズバリデーション (max 10MB) が動作する
- [ ] 画像解像度バリデーション (min 640x480px) が動作する
- [ ] 選択した画像をクリアできる
- [ ] iOS Simulatorでギャラリー選択が動作する
- [ ] 実機でカメラ撮影が動作する

## 検証手順

```bash
cd bananadish-app

# TypeScriptチェック
npm run type-check

# iOSシミュレーターで起動
npm run ios
```

**手動テスト (シミュレーター)**:

1. **ギャラリー選択**:
   - ホーム画面で「ライブラリから選択」をタップ
   - パーミッションリクエストが表示される → 「許可」
   - フォトライブラリが開く
   - 画像を選択
   - プレビューに表示される → ✓

2. **画像クリア**:
   - プレビュー右上の「×」ボタンをタップ
   - 画像がクリアされる → ✓

3. **パーミッション状態表示**:
   - 画面下部にパーミッション状態が表示される
   - 許可後は「✓ カメラ権限」等と表示される → ✓

**手動テスト (実機)**:

1. **カメラ撮影**:
   - 「写真を撮る」をタップ
   - カメラが起動
   - 写真を撮影
   - プレビューに表示される → ✓

2. **パーミッション拒否テスト**:
   - アプリを削除
   - 再インストール
   - カメラをタップ → パーミッション拒否
   - アラートが表示される → 「設定を開く」をタップ
   - 設定アプリが開く → ✓

3. **ファイルサイズバリデーション**:
   - 10MB以上の画像を選択
   - エラーアラートが表示される → ✓

## トラブルシューティング

### 問題: カメラがシミュレーターで動作しない

**解決策**:
- カメラはiOS実機でのみ動作
- シミュレーターではギャラリー選択のみテスト可能

### 問題: パーミッションが常に拒否される

**症状**: アプリ再起動後もパーミッションがリクエストされない

**解決策**:
```bash
# アプリを完全に削除
# シミュレーターをリセット
xcrun simctl erase all

# 実機の場合: 設定 → BananaDish → 権限をリセット
```

### 問題: 画像が表示されない

**症状**: URI is set but Image component doesn't render

**解決策**:
```typescript
// result.assets[0].uri が正しく取得できているか確認
console.log('Selected image URI:', result.assets[0].uri);

// Image componentのsourceが正しいか確認
<Image source={{ uri: selectedImage }} />
```

### 問題: ファイルサイズが取得できない

**症状**: `asset.fileSize` が undefined

**解決策**:
```bash
# expo-file-systemを使用してファイル情報を取得
npm install expo-file-system

import * as FileSystem from 'expo-file-system';
const fileInfo = await FileSystem.getInfoAsync(asset.uri);
console.log('File size:', fileInfo.size);
```

## Deliverables

- カメラ撮影機能
- フォトライブラリ選択機能
- パーミッション管理ロジック
- 画像プレビュー表示
- 画像バリデーション (サイズ・解像度)

## Notes

- **シミュレーター制限**: カメラは実機のみで動作
- **パーミッション**: iOS 14+ ではパーミッションが必須
- **画像品質**: quality: 1 で最高品質を指定 (圧縮なし)
- **次のステップ**: T205で選択した画像を使用した生成フローを実装

## 関連ドキュメント

- [技術設計書 - Image Handling](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#image-handling)
- [実装計画書 - T204](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t204-camera--gallery-integration)
- [Expo Image Picker Docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
