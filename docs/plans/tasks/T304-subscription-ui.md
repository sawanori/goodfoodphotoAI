# T304: Subscription Management UI Implementation

## 基本情報
- **タスクID**: T304
- **フェーズ**: Phase 3: Payment Integration
- **依存タスク**: T302 (IAP Integration), T303 (Receipt Validation)
- **成果物**:
  - サブスクリプションアップグレードフロー
  - 追加生成購入フロー
  - 購入復元フロー
  - クォータ超過モーダル
- **推定時間**: 3-4時間

## 概要
T207で作成したプレースホルダーを実装に置き換え、完全なサブスクリプション管理UIを完成させます。購入確認、成功アニメーション、エラーハンドリングを含みます。

## 前提条件
- [ ] T302完了 (IAP機能実装済み)
- [ ] T303完了 (レシート検証実装済み)
- [ ] T207完了 (Settings画面基盤)
- [ ] useIAPフック利用可能

## 実装手順

### Step 1: Subscription Upgrade Flow実装

`screens/SubscriptionUpgradeScreen.tsx` を作成:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIAP } from '@/hooks/useIAP';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { validateReceipt } from '@/services/api/subscription';
import { IAP_PRODUCTS } from '@/constants/iap';

export default function SubscriptionUpgradeScreen() {
  const { idToken } = useAuth();
  const { refresh } = useSubscription();
  const { subscriptions, purchaseSubscription } = useIAP();
  const [purchasing, setPurchasing] = useState(false);

  const starterProduct = subscriptions.find(
    p => p.productId === IAP_PRODUCTS.STARTER_MONTHLY
  );

  const handlePurchase = async () => {
    if (!starterProduct || !idToken) return;

    Alert.alert(
      'Starterプランを購入',
      `${starterProduct.localizedPrice}/月\n\n特典:\n✓ 月30回の生成\n✓ 高品質JPEG出力\n✓ 4種類のアスペクト比\n✓ いつでもキャンセル可能`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            setPurchasing(true);
            try {
              const result = await purchaseSubscription(IAP_PRODUCTS.STARTER_MONTHLY);

              // レシート検証
              await validateReceipt(idToken, result.receiptData, result.transactionId);

              // サブスクリプション情報更新
              await refresh();

              Alert.alert(
                '購入完了',
                'Starterプランへようこそ!\n月30回の生成が利用可能になりました。',
                [{ text: 'OK', onPress: () => {/* Navigate back */} }]
              );
            } catch (err: any) {
              if (!err.userCancelled) {
                Alert.alert('購入エラー', err.message || '購入処理に失敗しました');
              }
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
      <View style={styles.container}>
        <ActivityIndicator />
        <Text>製品情報を読み込んでいます...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="star" size={64} color="#FFD700" />
        <Text style={styles.title}>Starterプラン</Text>
        <Text style={styles.price}>{starterProduct.localizedPrice}/月</Text>
      </View>

      <View style={styles.features}>
        {[
          '月30回のプロ級写真生成',
          '4種類のアスペクト比対応',
          '高品質JPEG出力',
          'カメラロールに自動保存',
          'いつでもキャンセル可能',
        ].map((feature, index) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginVertical: 40,
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
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
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
  },
});
```

### Step 2: Quota Exceeded Modal実装

`components/QuotaExceededModal.tsx` を作成:

```typescript
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const { idToken } = useAuth();
  const { subscription, refresh } = useSubscription();
  const { products, purchaseProduct } = useIAP();
  const [purchasing, setPurchasing] = React.useState(false);

  const addonProduct = products.find(
    p => p.productId === IAP_PRODUCTS.ADDON_10_GENERATIONS
  );

  const handleBuyAddon = async () => {
    if (!addonProduct || !idToken) return;

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
              await validateReceipt(idToken, result.receiptData, result.transactionId);
              await refresh();

              Alert.alert('購入完了', '10回の追加生成が利用可能になりました');
              onClose();
            } catch (err: any) {
              if (!err.userCancelled) {
                Alert.alert('購入エラー', err.message);
              }
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
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
              style={styles.addonButton}
              onPress={handleBuyAddon}
              disabled={purchasing}
            >
              <Text style={styles.addonButtonText}>
                追加生成を購入 ({addonProduct?.localizedPrice || '¥980'})
              </Text>
              <Text style={styles.addonDescription}>すぐに10回追加</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => {/* Navigate to subscription upgrade */}}
            >
              <Text style={styles.upgradeButtonText}>Starterプランにアップグレード</Text>
              <Text style={styles.upgradeDescription}>月30回 + その他特典</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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

### Step 3: Restore Purchases実装

T207の`handleRestorePurchases`を更新:

```typescript
const handleRestorePurchases = async () => {
  setPurchasing(true);
  try {
    await restorePurchases();

    // 復元されたレシートを検証
    // (react-native-iapのrestoreは自動的にpurchaseUpdateListenerをトリガー)

    Alert.alert(
      '復元完了',
      '以前の購入が復元されました。サブスクリプション情報を更新しています...'
    );

    // 少し待ってからリフレッシュ
    setTimeout(async () => {
      await refresh();
    }, 2000);
  } catch (err: any) {
    Alert.alert('復元エラー', err.message || '購入の復元に失敗しました');
  } finally {
    setPurchasing(false);
  }
};
```

### Step 4: Generation時のクォータチェック統合

`app/(tabs)/home.tsx` の生成ロジックに追加:

```typescript
import { QuotaExceededModal } from '@/components/QuotaExceededModal';

export default function HomeScreen() {
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const handleGenerate = async () => {
    try {
      const response = await generateImages(/* ... */);
      // 成功
    } catch (error: any) {
      if (error.code === 'QUOTA_EXCEEDED') {
        setShowQuotaModal(true);
      } else {
        Alert.alert('エラー', error.message);
      }
    }
  };

  return (
    <View>
      {/* 既存のUI */}
      <QuotaExceededModal
        visible={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
      />
    </View>
  );
}
```

## 完了条件（DoD）

- [ ] Starter購入フローが完全に動作する
- [ ] 追加生成購入フローが完全に動作する
- [ ] 購入復元機能が動作する
- [ ] クォータ超過時にモーダルが表示される
- [ ] 購入後にサブスクリプション情報が自動更新される
- [ ] 購入成功時に確認メッセージが表示される
- [ ] エラー時に適切なメッセージが表示される
- [ ] 全てのUIが日本語化されている
- [ ] Sandboxテストで全フローが成功する

## 検証手順

```bash
# iOS実機でテスト
npm run ios --device

# テストシナリオ:
# 1. Starter購入フロー
#    - 設定画面で「サブスクリプション管理」をタップ
#    - 「今すぐ購入する」をタップ
#    - Sandbox購入完了
#    - 設定画面でtierが「Starter」に更新されることを確認
#    - 使用制限が30回に更新されることを確認

# 2. 追加生成購入フロー
#    - 生成を10回実行してクォータを使い切る
#    - 11回目の生成を試行
#    - クォータ超過モーダルが表示されることを確認
#    - 「追加生成を購入」をタップ
#    - Sandbox購入完了
#    - 使用制限が+10されることを確認

# 3. 購入復元フロー
#    - アプリを削除
#    - 再インストール
#    - ログイン
#    - 設定画面で「購入の復元」をタップ
#    - Starterプランが復元されることを確認
```

## トラブルシューティング

### 問題: 購入後にサブスクリプション情報が更新されない

**症状**: 購入完了後も設定画面に反映されない

**解決策**:
```typescript
// レシート検証成功後、必ずrefreshを呼ぶ
await validateReceipt(idToken, receiptData, transactionId);
await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
await refresh();

// SubscriptionContextのrefresh実装確認
const refresh = async () => {
  const data = await fetchSubscriptionStatus(idToken);
  setSubscription(data); // 状態更新
};
```

### 問題: クォータモーダルが表示されない

**症状**: QUOTA_EXCEEDEDエラーが発生してもモーダルが出ない

**解決策**:
```typescript
// エラーレスポンスのcode確認
catch (error: any) {
  console.log('Error code:', error.code);
  console.log('Error message:', error.message);

  if (error.code === 'QUOTA_EXCEEDED') {
    setShowQuotaModal(true);
  }
}

// バックエンドがエラーコードを返しているか確認
// backend: res.status(402).json({ error: 'QUOTA_EXCEEDED', ... })
```

## Deliverables

- `screens/SubscriptionUpgradeScreen.tsx` - アップグレード画面
- `components/QuotaExceededModal.tsx` - クォータ超過モーダル
- 更新された `app/(tabs)/settings.tsx` - 購入復元実装
- 更新された `app/(tabs)/home.tsx` - クォータチェック統合

## Notes

- **UX重視**: 購入フローはシンプルで分かりやすく
- **即座反映**: 購入後すぐにUIに反映
- **エラーハンドリング**: ユーザーキャンセルは正常系
- **Sandbox表示**: Sandbox購入時は「Environment: Sandbox」が表示される
- **自動更新**: サブスクリプションは自動更新されることを明示

## 関連ドキュメント

- [実装計画書 - T304](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t304-subscription-management-ui-implementation)
- [Apple HIG - In-App Purchase](https://developer.apple.com/design/human-interface-guidelines/in-app-purchase)
