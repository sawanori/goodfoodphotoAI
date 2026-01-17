# T206: Results Display & Camera Roll Save Implementation

## 基本情報
- **タスクID**: T206
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**: T205 (Generation Flow UI Implementation)
- **成果物**:
  - Results表示画面/モーダル
  - ImageGridコンポーネント
  - Camera roll保存機能
  - 保存成功モーダル
- **推定時間**: 3-4時間

## 概要
生成された4枚の画像を2x2グリッドで表示し、全画像をカメラロールに一括保存する機能を実装します。フルスクリーンプレビュー、ピンチズーム、アルバム作成も含みます。

## 前提条件
- [ ] T205が完了し、生成APIから4枚の画像(base64)を受信できている
- [ ] expo-media-library がインストール済み
- [ ] expo-file-system がインストール済み
- [ ] 生成ステート管理が実装されている

## 実装手順

### Step 1: ImageGridコンポーネントの作成

`components/ImageGrid.tsx` を作成:

```typescript
import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface ImageGridProps {
  images: Array<{ mime: string; b64: string }>;
  onImagePress?: (index: number) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onImagePress }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleImagePress = (index: number) => {
    setSelectedIndex(index);
    onImagePress?.(index);
  };

  const closeFullScreen = () => {
    setSelectedIndex(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {images.map((img, index) => (
          <TouchableOpacity
            key={index}
            style={styles.gridItem}
            onPress={() => handleImagePress(index)}
          >
            <Image
              source={{ uri: `data:${img.mime};base64,${img.b64}` }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Full-screen preview modal */}
      {selectedIndex !== null && (
        <Modal
          visible={true}
          transparent={false}
          animationType="fade"
          onRequestClose={closeFullScreen}
        >
          <StatusBar hidden />
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity
              style={styles.fullScreenTouchable}
              activeOpacity={1}
              onPress={closeFullScreen}
            >
              <Image
                source={{
                  uri: `data:${images[selectedIndex].mime};base64,${images[selectedIndex].b64}`,
                }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
```

### Step 2: Media Library保存サービスの実装

`services/storage/mediaLibrary.ts` を作成:

```typescript
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

interface SaveResult {
  success: boolean;
  savedCount: number;
  albumName: string;
}

/**
 * Base64画像をカメラロールに保存
 */
const saveBase64Image = async (base64: string, mime: string): Promise<string> => {
  // Base64からファイルを作成
  const fileUri = `${FileSystem.cacheDirectory}bananadish_${Date.now()}.jpg`;

  // data:image/jpeg;base64, プレフィックスを除去
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return fileUri;
};

/**
 * BananaDishアルバムを取得または作成
 */
const getOrCreateAlbum = async (
  assetId: string
): Promise<MediaLibrary.Album | null> => {
  const albumName = 'BananaDish';

  try {
    // 既存のアルバムを検索
    const albums = await MediaLibrary.getAlbumsAsync();
    const existingAlbum = albums.find(album => album.title === albumName);

    if (existingAlbum) {
      return existingAlbum;
    }

    // アルバムが存在しない場合は作成
    const asset = await MediaLibrary.getAssetInfoAsync(assetId);
    const album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
    return album;
  } catch (error) {
    console.error('Album creation failed:', error);
    return null;
  }
};

/**
 * 4枚の画像を全てカメラロールに保存
 */
export const saveAllImages = async (
  images: Array<{ mime: string; b64: string }>
): Promise<SaveResult> => {
  // パーミッション確認
  const permission = await MediaLibrary.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  const savedAssets: string[] = [];
  let album: MediaLibrary.Album | null = null;

  try {
    // 各画像を順次保存
    for (const img of images) {
      // Base64からファイル作成
      const fileUri = await saveBase64Image(img.b64, img.mime);

      // メディアライブラリにアセット作成
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      savedAssets.push(asset.id);

      // 最初の画像でアルバム作成/取得
      if (!album) {
        album = await getOrCreateAlbum(asset.id);
      } else {
        // 2枚目以降はアルバムに追加
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      // キャッシュファイルを削除
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }

    return {
      success: true,
      savedCount: savedAssets.length,
      albumName: 'BananaDish',
    };
  } catch (error) {
    console.error('Save failed:', error);
    throw error;
  }
};

/**
 * パーミッションステータスを確認
 */
export const checkMediaLibraryPermission = async (): Promise<boolean> => {
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status === 'granted';
};
```

### Step 3: Results表示画面の実装

`app/(tabs)/home.tsx` を更新して結果表示を追加:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { ImageGrid } from '@/components/ImageGrid';
import { saveAllImages } from '@/services/storage/mediaLibrary';

interface GeneratedImage {
  mime: string;
  b64: string;
}

export default function HomeScreen() {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // ... (既存のカメラ/ギャラリー選択、生成ロジック)

  const handleSaveAll = async () => {
    if (generatedImages.length !== 4) {
      Alert.alert('エラー', '保存する画像がありません');
      return;
    }

    setIsSaving(true);

    try {
      const result = await saveAllImages(generatedImages);

      Alert.alert(
        '保存完了',
        `${result.savedCount}枚の写真を「${result.albumName}」アルバムに保存しました`,
        [
          {
            text: 'OK',
            onPress: handleGenerateAgain,
          },
        ]
      );
    } catch (error: any) {
      if (error.message === 'PERMISSION_DENIED') {
        Alert.alert(
          '権限が必要です',
          '写真を保存するには、設定からフォトライブラリへのアクセスを許可してください',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '設定を開く', onPress: () => {/* Open settings */} },
          ]
        );
      } else {
        Alert.alert('保存エラー', '写真の保存中にエラーが発生しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAgain = () => {
    setGeneratedImages([]);
    setShowResults(false);
    // 状態をリセット
  };

  if (showResults && generatedImages.length === 4) {
    return (
      <View style={styles.resultsContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>完成しました!</Text>
          <Text style={styles.subtitle}>4枚のプロ級写真が生成されました</Text>

          <ImageGrid images={generatedImages} />

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.disabledButton]}
            onPress={handleSaveAll}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>全て保存する</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGenerateAgain}
          >
            <Text style={styles.secondaryButtonText}>もう一度生成する</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ... (既存のホーム画面UI)
  return (
    <View style={styles.container}>
      <Text>ホーム画面</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

### Step 4: パーミッション処理の追加

`hooks/useMediaPermissions.ts` を作成 (既存の場合は更新):

```typescript
import { useState, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';

interface MediaPermissions {
  granted: boolean;
  canAskAgain: boolean;
  requestPermission: () => Promise<boolean>;
}

export const useMediaPermissions = (): MediaPermissions => {
  const [granted, setGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
    setGranted(status === 'granted');
    setCanAskAgain(canAskAgain);
  };

  const requestPermission = async (): Promise<boolean> => {
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
    setGranted(status === 'granted');
    setCanAskAgain(canAskAgain);
    return status === 'granted';
  };

  return {
    granted,
    canAskAgain,
    requestPermission,
  };
};
```

### Step 5: エラーハンドリングの強化

保存失敗時の詳細なエラーメッセージを追加:

```typescript
// services/storage/mediaLibrary.ts に追加

export class SaveImageError extends Error {
  constructor(
    message: string,
    public code: 'PERMISSION_DENIED' | 'SAVE_FAILED' | 'ALBUM_CREATION_FAILED'
  ) {
    super(message);
    this.name = 'SaveImageError';
  }
}

// saveAllImages関数でエラーハンドリング改善
export const saveAllImages = async (
  images: Array<{ mime: string; b64: string }>
): Promise<SaveResult> => {
  const permission = await MediaLibrary.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new SaveImageError(
      'フォトライブラリへのアクセスが拒否されました',
      'PERMISSION_DENIED'
    );
  }

  // ... 既存のコード

  try {
    // ... 保存処理
  } catch (error) {
    console.error('Save failed:', error);
    throw new SaveImageError(
      '画像の保存中にエラーが発生しました',
      'SAVE_FAILED'
    );
  }
};
```

## 完成コード

上記のStep 1-5を実装すると、以下の機能が完成します:

- 4枚の画像を2x2グリッドで表示
- タップでフルスクリーンプレビュー
- 全画像を一括保存
- 「BananaDish」アルバムに自動整理
- 保存成功時の確認メッセージ
- エラーハンドリング (パーミッション拒否、保存失敗)

## 完了条件（DoD）

- [ ] ImageGridコンポーネントが4枚の画像を表示している
- [ ] タップで各画像がフルスクリーン表示される
- [ ] フルスクリーン時にタップで閉じられる
- [ ] 「全て保存する」ボタンが機能する
- [ ] 4枚全ての画像がカメラロールに保存される
- [ ] 「BananaDish」アルバムが作成され、画像が追加される
- [ ] 保存成功時に確認メッセージが表示される
- [ ] パーミッション拒否時に適切なエラーメッセージが表示される
- [ ] 「もう一度生成する」ボタンで状態がリセットされる
- [ ] 保存中はローディングインジケーターが表示される

## 検証手順

```bash
# iOS Simulatorで実行
cd bananadish-app
npm run ios

# 検証手順:
# 1. ホーム画面で画像を選択して生成実行
# 2. 4枚の画像が2x2グリッドで表示されることを確認
# 3. 各画像をタップしてフルスクリーン表示を確認
# 4. 「全て保存する」ボタンをタップ
# 5. パーミッションダイアログで「許可」を選択
# 6. 保存成功メッセージが表示されることを確認
# 7. iOSの写真アプリを開く
# 8. 「アルバム」タブで「BananaDish」アルバムを確認
# 9. 4枚の画像が保存されていることを確認

# 物理デバイスでのテスト:
# - 実際のカメラロール保存動作を確認
# - パーミッション処理の完全な動作確認
```

## トラブルシューティング

### 問題: 画像が保存されない

**症状**: 「全て保存する」を押しても写真アプリに画像が表示されない

**解決策**:
```bash
# パーミッション確認
# 設定 > BananaDish > 写真 で「すべての写真へのアクセスを許可」を確認

# Base64デコードエラーのチェック
# console.logでbase64データの最初の50文字を確認
console.log(img.b64.substring(0, 50));

# FileSystemのキャッシュディレクトリ確認
console.log(FileSystem.cacheDirectory);
```

### 問題: アルバムが作成されない

**症状**: 写真は保存されるが「BananaDish」アルバムに入らない

**解決策**:
```typescript
// アルバム作成ロジックの確認
const album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
// 第3引数がfalse = 既存の場所にコピー (true = アルバムに移動)

// デバッグログ追加
console.log('Album created:', album);
console.log('Assets added:', savedAssets.length);
```

### 問題: フルスクリーン画像がぼやける

**症状**: フルスクリーン表示時に画像がぼやけて見える

**解決策**:
```typescript
// resizeModeを変更
<Image
  source={{ uri: `data:${img.mime};base64,${img.b64}` }}
  style={styles.fullScreenImage}
  resizeMode="contain" // "cover" から "contain" に変更
/>

// 画像のキャッシュを有効化
<Image
  source={{ uri: `data:${img.mime};base64,${img.b64}` }}
  style={styles.fullScreenImage}
  resizeMode="contain"
  defaultSource={require('@/assets/placeholder.png')}
/>
```

### 問題: 保存が遅い

**症状**: 4枚の保存に10秒以上かかる

**解決策**:
```typescript
// 並列保存に変更 (順次保存ではなく)
const savePromises = images.map(async (img, index) => {
  const fileUri = await saveBase64Image(img.b64, img.mime);
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
  return asset;
});

const assets = await Promise.all(savePromises);

// その後アルバムに一括追加
if (album) {
  await MediaLibrary.addAssetsToAlbumAsync(assets, album, false);
}
```

## Deliverables

- `components/ImageGrid.tsx` - 画像グリッド表示コンポーネント
- `services/storage/mediaLibrary.ts` - カメラロール保存サービス
- `hooks/useMediaPermissions.ts` - メディアライブラリパーミッションフック
- 更新された `app/(tabs)/home.tsx` - 結果表示画面
- 保存成功モーダル

## Notes

- **Design Doc準拠**: "contain + blurred background" でフォーマット済みの画像を保存
- **Performance目標**: 4枚の保存を3秒以内に完了 (並列処理で実現)
- **UX考慮**: 保存中のローディング表示、成功時の明確なフィードバック
- **Error Handling**: パーミッション拒否、ストレージ不足、ネットワークエラーに対応
- **Accessibility**: VoiceOver対応 (ボタンに適切なlabel設定)

## 関連ドキュメント

- [技術設計書 - Image Handling](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#image-handling)
- [実装計画書 - T206](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t206-results-display--camera-roll-save-implementation)
