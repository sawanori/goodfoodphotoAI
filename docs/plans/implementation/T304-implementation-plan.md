# T304: Subscription Management UI Implementation - 実装計画書

## 基本情報

| 項目 | 内容 |
|------|------|
| タスクID | T304 |
| タスク名 | Subscription Management UI Implementation |
| 担当モデル | Sonnet (Task agent) |
| 依存タスク | T302 (IAP Integration), T303 (Receipt Validation) |
| 推定時間 | 3-4時間 |
| 作成日 | 2026-01-17 |

## 概要

T207で作成した設定画面のプレースホルダーを実装に置き換え、完全なサブスクリプション管理UIを完成させます。購入確認、成功アニメーション、エラーハンドリング、クォータ超過モーダルを含みます。

## 実装方針

### アプローチ

1. **既存画面の拡張**: T207の設定画面を拡張（破壊的変更なし）
2. **コンポーネント分離**: 再利用可能なコンポーネントを作成
3. **UX重視**: シンプルで分かりやすい購入フロー
4. **即座反映**: 購入後すぐにUIに反映

### 実装ファイル構成

```
mobile/
├── screens/
│   └── SubscriptionUpgradeScreen.tsx    # アップグレード画面
├── components/
│   ├── QuotaExceededModal.tsx          # クォータ超過モーダル
│   └── SubscriptionCard.tsx            # サブスクリプションカード（T207で作成済み）
└── app/(tabs)/
    ├── settings.tsx                    # 設定画面（購入復元実装）
    └── home.tsx                        # ホーム画面（クォータチェック統合）
```

## 詳細実装手順

### Step 1: サブスクリプションアップグレード画面 (`screens/SubscriptionUpgradeScreen.tsx`)

```typescript
// mobile/screens/SubscriptionUpgradeScreen.tsx
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { validateReceipt } from '@/services/api/subscription';
import { IAP_PRODUCTS, PRODUCT_INFO } from '@/constants/iap';

export default function SubscriptionUpgradeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscription, refresh } = useSubscription();
  const { subscriptions, purchaseSubscription } = useIAP();
  const [purchasing, setPurchasing] = useState(false);

  const starterProduct = subscriptions.find(
    p => p.productId === IAP_PRODUCTS.STARTER_MONTHLY
  );

  const starterInfo = PRODUCT_INFO[IAP_PRODUCTS.STARTER_MONTHLY];

  const handlePurchase = async () => {
    if (!starterProduct || !user) return;

    Alert.alert(
      'Starterプランを購入',
      `${starterProduct.localizedPrice}/月\n\n購入を続行しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            setPurchasing(true);
            try {
              // IAP購入実行
              const result = await purchaseSubscription(IAP_PRODUCTS.STARTER_MONTHLY);
              console.log('[T304] Purchase result:', result);

              // レシート検証（T303）
              const idToken = await user.getIdToken();
              await validateReceipt(idToken, result.receiptData, result.transactionId);
              console.log('[T304] Receipt validated');

              // サブスクリプション情報更新
              await refresh();

              Alert.alert(
                '購入完了',
                'Starterプランへようこそ!\n月30回の生成が利用可能になりました。',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (err: any) {
              console.error('[T304] Purchase error:', err);
              Alert.alert('購入エラー', err.message || '購入処理に失敗しました');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  if (!starterProduct) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>製品情報を読み込んでいます...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="star" size={64} color="#FFD700" />
        <Text style={styles.title}>Starterプラン</Text>
        <Text style={styles.price}>{starterProduct.localizedPrice}/月</Text>
      </View>

      <View style={styles.features}>
        <Text style={styles.featuresTitle}>プランに含まれる特典</Text>
        {starterInfo.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.purchaseButton, purchasing && styles.disabledButton]}
        onPress={handlePurchase}
        disabled={purchasing}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.purchaseButtonText}>今すぐ購入する</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        サブスクリプションは自動更新されます。いつでもキャンセル可能です。
      </Text>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>キャンセル</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
  },
  price: {
    fontSize: 24,
    color: '#007AFF',
    marginTop: 8,
  },
  features: {
    marginVertical: 24,
    paddingHorizontal: 20,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 20,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
```

**実装理由**:
- シンプルで分かりやすい購入フロー
- 製品情報を見やすく表示
- 購入確認ダイアログで誤操作を防止
- ローディング状態を明確に表示

### Step 2: クォータ超過モーダル (`components/QuotaExceededModal.tsx`)

```typescript
// mobile/components/QuotaExceededModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { validateReceipt } from '@/services/api/subscription';
import { IAP_PRODUCTS } from '@/constants/iap';

interface QuotaExceededModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { subscription, refresh } = useSubscription();
  const { products, purchaseProduct } = useIAP();
  const [purchasing, setPurchasing] = useState(false);

  const addonProduct = products.find(
    p => p.productId === IAP_PRODUCTS.ADDON_10_GENERATIONS
  );

  const handleBuyAddon = async () => {
    if (!addonProduct || !user) return;

    Alert.alert(
      '追加生成を購入',
      `${addonProduct.localizedPrice}で10回の追加生成を購入しますか?`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            setPurchasing(true);
            try {
              const result = await purchaseProduct(IAP_PRODUCTS.ADDON_10_GENERATIONS);
              console.log('[T304] Addon purchase result:', result);

              const idToken = await user.getIdToken();
              await validateReceipt(idToken, result.receiptData, result.transactionId);
              console.log('[T304] Addon receipt validated');

              await refresh();

              Alert.alert('購入完了', '10回の追加生成が利用可能になりました');
              onClose();
            } catch (err: any) {
              console.error('[T304] Addon purchase error:', err);
              Alert.alert('購入エラー', err.message);
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    onClose();
    // SubscriptionUpgradeScreenに遷移
    // router.push('/subscription-upgrade'); // ルート設定後に有効化
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Ionicons name="warning-outline" size={64} color="#FF3B30" />
          <Text style={styles.title}>今月の利用上限に達しました</Text>
          <Text style={styles.message}>
            今月は {subscription?.limit || 10} 回の生成を全て使い切りました。
          </Text>

          <View style={styles.options}>
            <TouchableOpacity
              style={[styles.addonButton, purchasing && styles.disabledButton]}
              onPress={handleBuyAddon}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.addonButtonText}>
                    追加生成を購入 ({addonProduct?.localizedPrice || '¥980'})
                  </Text>
                  <Text style={styles.addonDescription}>すぐに10回追加</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              disabled={purchasing}
            >
              <Text style={styles.upgradeButtonText}>Starterプランにアップグレード</Text>
              <Text style={styles.upgradeDescription}>月30回 + その他特典</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={purchasing}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  options: {
    width: '100%',
    marginTop: 24,
  },
  addonButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  addonButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  addonDescription: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
  upgradeButton: {
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  upgradeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  upgradeDescription: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  closeButton: {
    marginTop: 16,
    padding: 12,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 14,
  },
});
```

**実装理由**:
- クォータ超過時のUXを向上
- 追加生成とアップグレードの選択肢を提示
- 購入処理中はボタンを無効化

### Step 3: 設定画面の購入復元実装 (`app/(tabs)/settings.tsx`)

既存の設定画面に以下を追加:

```typescript
// app/(tabs)/settings.tsx に追加
import { useIAP } from '@/hooks/useIAP';
import { validateReceipt } from '@/services/api/subscription';

export default function SettingsScreen() {
  // 既存のフック
  const { user, signOut } = useAuth();
  const { subscription, loading, error, refresh } = useSubscription();
  const { restorePurchases } = useIAP();

  const [restoring, setRestoring] = useState(false);

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      await restorePurchases();

      Alert.alert(
        '復元完了',
        '以前の購入が復元されました。サブスクリプション情報を更新しています...'
      );

      // 少し待ってからリフレッシュ（レシート検証完了待ち）
      setTimeout(async () => {
        await refresh();
      }, 2000);
    } catch (err: any) {
      console.error('[T304] Restore error:', err);
      Alert.alert('復元エラー', err.message || '購入の復元に失敗しました');
    } finally {
      setRestoring(false);
    }
  };

  // 既存のUIに以下を追加
  return (
    <ScrollView>
      {/* 既存のUI */}

      {/* 購入復元ボタン */}
      <TouchableOpacity
        style={styles.restoreButton}
        onPress={handleRestorePurchases}
        disabled={restoring}
      >
        {restoring ? (
          <ActivityIndicator color="#007AFF" />
        ) : (
          <Text style={styles.restoreButtonText}>購入の復元</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// スタイル追加
const styles = StyleSheet.create({
  // 既存のスタイル
  restoreButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
```

**実装理由**:
- アプリ再インストール後の購入復元
- 非同期処理を適切にハンドリング
- ユーザーにフィードバックを提供

### Step 4: ホーム画面へのクォータチェック統合 (`app/(tabs)/home.tsx`)

```typescript
// app/(tabs)/home.tsx に追加
import { QuotaExceededModal } from '@/components/QuotaExceededModal';
import { useState } from 'react';

export default function HomeScreen() {
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const handleGenerate = async () => {
    try {
      // 既存の生成ロジック
      const response = await generateImages(/* ... */);
      // 成功
    } catch (error: any) {
      if (error.code === 'QUOTA_EXCEEDED') {
        // クォータ超過時にモーダル表示
        setShowQuotaModal(true);
      } else {
        Alert.alert('エラー', error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* 既存のUI */}

      {/* クォータ超過モーダル */}
      <QuotaExceededModal
        visible={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
      />
    </View>
  );
}
```

**実装理由**:
- クォータ超過時に即座にアップセル
- ユーザー体験を向上
- エラーハンドリングを統一

## 完了条件（DoD）

- [ ] `screens/SubscriptionUpgradeScreen.tsx` でアップグレード画面実装済み
- [ ] `components/QuotaExceededModal.tsx` でクォータ超過モーダル実装済み
- [ ] `app/(tabs)/settings.tsx` で購入復元実装済み
- [ ] `app/(tabs)/home.tsx` でクォータチェック統合済み
- [ ] Starter購入フローが完全に動作する
- [ ] 追加生成購入フローが完全に動作する
- [ ] 購入復元機能が動作する
- [ ] クォータ超過時にモーダルが表示される
- [ ] 購入後にサブスクリプション情報が自動更新される
- [ ] 全てのUIが日本語化されている

## 検証手順

```bash
# 1. アプリ起動
cd /home/noritakasawada/project/20260117/mobile
npm run ios

# 2. サブスクリプションアップグレード画面テスト
# - 設定画面で「Starterプランにアップグレード」をタップ
# - アップグレード画面が表示される
# - 製品情報が正しく表示される
# - 「今すぐ購入する」をタップ
# - 確認ダイアログが表示される
# - 「購入する」をタップ
# - モック購入完了
# - 設定画面に戻る
# - サブスクリプション情報が更新される

# 3. クォータ超過モーダルテスト
# - ホーム画面で生成を10回実行（Freeプラン上限）
# - 11回目の生成を試行
# - クォータ超過モーダルが表示される
# - 「追加生成を購入」をタップ
# - 確認ダイアログが表示される
# - 「購入する」をタップ
# - モック購入完了
# - モーダルが閉じる
# - 生成可能回数が増加する

# 4. 購入復元テスト
# - 設定画面で「購入の復元」をタップ
# - 復元処理実行
# - 「復元完了」アラートが表示される
# - サブスクリプション情報が更新される
```

## トラブルシューティング

### 問題: 購入後にサブスクリプション情報が更新されない

**症状**: 購入完了後も設定画面に反映されない

**解決策**:
```typescript
// refresh() が正しく呼ばれているか確認
await validateReceipt(idToken, receiptData, transactionId);
console.log('[DEBUG] Waiting for backend update...');
await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
await refresh();
console.log('[DEBUG] Subscription refreshed');
```

### 問題: クォータモーダルが表示されない

**症状**: QUOTA_EXCEEDEDエラーが発生してもモーダルが出ない

**解決策**:
```typescript
// エラーレスポンスのcode確認
catch (error: any) {
  console.log('[DEBUG] Error code:', error.code);
  console.log('[DEBUG] Error message:', error.message);

  if (error.code === 'QUOTA_EXCEEDED') {
    setShowQuotaModal(true);
  }
}

// バックエンドがエラーコードを返しているか確認
// backend: res.status(402).json({ error: 'QUOTA_EXCEEDED', ... })
```

### 問題: 画面遷移が動作しない

**症状**: router.push() が動作しない

**解決策**:
```bash
# expo-router のルート設定確認
# app/subscription-upgrade.tsx を作成
# または screens/ からインポート
```

## 次のステップ

T304完了後、全タスクの統合検証を実施します。

## 関連ドキュメント

- [T304タスクファイル](/home/noritakasawada/project/20260117/docs/plans/tasks/T304-subscription-ui.md)
- [Apple HIG - In-App Purchase](https://developer.apple.com/design/human-interface-guidelines/in-app-purchase)
