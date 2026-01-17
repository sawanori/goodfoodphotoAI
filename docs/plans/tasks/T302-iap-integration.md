# T302: React Native IAP Integration

## 基本情報
- **タスクID**: T302
- **フェーズ**: Phase 3: Payment Integration
- **依存タスク**: T301 (Apple Developer Setup), T207 (Settings & Profile)
- **成果物**:
  - IAP service module (`services/iap/purchaseManager.ts`)
  - Product list取得機能
  - Purchase flow実装
  - Restore purchases機能
  - Receipt data extraction
- **推定時間**: 4-5時間

## 概要
react-native-iapライブラリを統合し、Apple In-App Purchaseの購入フローを実装します。サブスクリプション購入、追加生成購入、購入の復元機能を含みます。

## 前提条件
- [ ] T301完了 (IAP製品がApp Store Connectで「準備完了」)
- [ ] T207完了 (SubscriptionContext実装済み)
- [ ] react-native-iap v14+ がインストール済み
- [ ] iOS実機またはSandboxテスター設定済み

## 実装手順

### Step 1: react-native-iap のインストールと設定

```bash
cd bananadish-app

# react-native-iap インストール
npm install react-native-iap@latest

# iOSの依存関係インストール
cd ios
pod install
cd ..
```

### Step 2: IAP製品ID定義

`constants/iap.ts` を作成:

```typescript
export const IAP_PRODUCTS = {
  STARTER_MONTHLY: 'com.bananadish.starter.monthly',
  ADDON_10_GENERATIONS: 'com.bananadish.addon.10gen',
} as const;

export const PRODUCT_IDS = Object.values(IAP_PRODUCTS);

export type ProductId = (typeof IAP_PRODUCTS)[keyof typeof IAP_PRODUCTS];
```

### Step 3: IAP types定義

`types/iap.ts` を作成:

```typescript
import { Purchase, Product, Subscription } from 'react-native-iap';

export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  receiptData: string;
  productId: string;
}

export interface PurchaseError {
  code: string;
  message: string;
  userCancelled: boolean;
}

export type IAPProduct = Product | Subscription;
```

### Step 4: Purchase Manager実装

`services/iap/purchaseManager.ts` を作成:

```typescript
import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestPurchase,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  PurchaseError as RNIAPError,
  Purchase,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { IAP_PRODUCTS, PRODUCT_IDS } from '@/constants/iap';
import type { PurchaseResult, PurchaseError, IAPProduct } from '@/types/iap';

class PurchaseManager {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;

  /**
   * IAP接続を初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('IAP already initialized');
      return;
    }

    try {
      await initConnection();
      console.log('IAP connection initialized');

      // Purchase update listener
      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          console.log('Purchase updated:', purchase);
          const receipt = purchase.transactionReceipt;
          if (receipt) {
            try {
              // レシート検証は別途実装 (T303)
              await finishTransaction({ purchase, isConsumable: false });
              console.log('Transaction finished:', purchase.transactionId);
            } catch (error) {
              console.error('Error finishing transaction:', error);
            }
          }
        }
      );

      // Purchase error listener
      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: RNIAPError) => {
          console.warn('Purchase error:', error);
        }
      );

      this.isInitialized = true;
    } catch (error) {
      console.error('IAP initialization failed:', error);
      throw error;
    }
  }

  /**
   * IAP接続を切断
   */
  async dispose(): Promise<void> {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }

    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }

    await endConnection();
    this.isInitialized = false;
    console.log('IAP connection disposed');
  }

  /**
   * 利用可能な製品を取得
   */
  async getAvailableProducts(): Promise<{
    subscriptions: IAPProduct[];
    products: IAPProduct[];
  }> {
    try {
      const [subscriptions, products] = await Promise.all([
        getSubscriptions({ skus: [IAP_PRODUCTS.STARTER_MONTHLY] }),
        getProducts({ skus: [IAP_PRODUCTS.ADDON_10_GENERATIONS] }),
      ]);

      console.log('Available subscriptions:', subscriptions);
      console.log('Available products:', products);

      return { subscriptions, products };
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw error;
    }
  }

  /**
   * サブスクリプション購入
   */
  async purchaseSubscription(
    productId: string
  ): Promise<PurchaseResult> {
    try {
      const purchase = await requestSubscription({
        sku: productId,
      });

      if (!purchase || !purchase.transactionReceipt) {
        throw new Error('Purchase failed: No receipt data');
      }

      return {
        success: true,
        transactionId: purchase.transactionId || '',
        receiptData: purchase.transactionReceipt,
        productId: purchase.productId,
      };
    } catch (error: any) {
      console.error('Subscription purchase failed:', error);
      throw this.handlePurchaseError(error);
    }
  }

  /**
   * 消費型アイテム購入
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      const purchase = await requestPurchase({ skus: [productId] });

      if (!purchase || !purchase.transactionReceipt) {
        throw new Error('Purchase failed: No receipt data');
      }

      return {
        success: true,
        transactionId: purchase.transactionId || '',
        receiptData: purchase.transactionReceipt,
        productId: purchase.productId,
      };
    } catch (error: any) {
      console.error('Product purchase failed:', error);
      throw this.handlePurchaseError(error);
    }
  }

  /**
   * 購入の復元
   */
  async restorePurchases(): Promise<Purchase[]> {
    try {
      // iOS specific
      if (Platform.OS === 'ios') {
        const purchases = await getProducts({ skus: PRODUCT_IDS });
        console.log('Restored purchases:', purchases);
        return purchases as any; // Type conversion for simplicity
      }
      return [];
    } catch (error) {
      console.error('Restore purchases failed:', error);
      throw error;
    }
  }

  /**
   * エラーハンドリング
   */
  private handlePurchaseError(error: any): PurchaseError {
    const errorCode = error?.code || 'UNKNOWN';
    let message = '購入に失敗しました';
    let userCancelled = false;

    switch (errorCode) {
      case 'E_USER_CANCELLED':
        message = '購入がキャンセルされました';
        userCancelled = true;
        break;
      case 'E_NETWORK_ERROR':
        message = 'ネットワークエラーが発生しました';
        break;
      case 'E_SERVICE_ERROR':
        message = 'App Storeサービスエラー';
        break;
      case 'E_RECEIPT_FAILED':
        message = 'レシート検証に失敗しました';
        break;
      case 'E_ALREADY_OWNED':
        message = 'すでに購入済みです';
        break;
      default:
        message = error?.message || '購入処理中にエラーが発生しました';
    }

    return {
      code: errorCode,
      message,
      userCancelled,
    };
  }
}

export const purchaseManager = new PurchaseManager();
```

### Step 5: useIAP カスタムフックの実装

`hooks/useIAP.ts` を作成:

```typescript
import { useState, useEffect } from 'react';
import { purchaseManager } from '@/services/iap/purchaseManager';
import type { IAPProduct, PurchaseResult, PurchaseError } from '@/types/iap';

interface UseIAPReturn {
  products: IAPProduct[];
  subscriptions: IAPProduct[];
  loading: boolean;
  error: string | null;
  purchaseProduct: (productId: string) => Promise<PurchaseResult>;
  purchaseSubscription: (productId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<void>;
}

export const useIAP = (): UseIAPReturn => {
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [subscriptions, setSubscriptions] = useState<IAPProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeIAP();

    return () => {
      purchaseManager.dispose();
    };
  }, []);

  const initializeIAP = async () => {
    try {
      await purchaseManager.initialize();
      const { subscriptions: subs, products: prods } =
        await purchaseManager.getAvailableProducts();

      setSubscriptions(subs);
      setProducts(prods);
      setError(null);
    } catch (err: any) {
      console.error('IAP initialization error:', err);
      setError('製品情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const purchaseProduct = async (productId: string): Promise<PurchaseResult> => {
    try {
      const result = await purchaseManager.purchaseProduct(productId);
      return result;
    } catch (err: any) {
      throw err;
    }
  };

  const purchaseSubscription = async (
    productId: string
  ): Promise<PurchaseResult> => {
    try {
      const result = await purchaseManager.purchaseSubscription(productId);
      return result;
    } catch (err: any) {
      throw err;
    }
  };

  const restorePurchases = async (): Promise<void> => {
    try {
      const purchases = await purchaseManager.restorePurchases();
      console.log('Purchases restored:', purchases);
      // レシート検証はT303で実装
    } catch (err: any) {
      throw new Error('購入の復元に失敗しました');
    }
  };

  return {
    products,
    subscriptions,
    loading,
    error,
    purchaseProduct,
    purchaseSubscription,
    restorePurchases,
  };
};
```

### Step 6: 購入フローUIの実装

`app/(tabs)/settings.tsx` を更新:

```typescript
import { useIAP } from '@/hooks/useIAP';
import { IAP_PRODUCTS } from '@/constants/iap';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { subscription, loading, error, refresh } = useSubscription();
  const {
    products,
    subscriptions,
    loading: iapLoading,
    purchaseSubscription,
    purchaseProduct,
    restorePurchases,
  } = useIAP();

  const [purchasing, setPurchasing] = useState(false);

  const handlePurchaseStarter = async () => {
    const starterProduct = subscriptions.find(
      p => p.productId === IAP_PRODUCTS.STARTER_MONTHLY
    );

    if (!starterProduct) {
      Alert.alert('エラー', '製品情報を取得できませんでした');
      return;
    }

    Alert.alert(
      'Starterプランを購入',
      `${starterProduct.localizedPrice}/月でStarterプランに登録しますか?\n\n- 月30回の生成\n- 高品質出力\n- いつでもキャンセル可能`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            setPurchasing(true);
            try {
              const result = await purchaseSubscription(IAP_PRODUCTS.STARTER_MONTHLY);
              console.log('Purchase result:', result);

              // T303でレシート検証を実装
              Alert.alert('購入完了', 'Starterプランに登録されました');
              await refresh();
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

  const handlePurchaseAddon = async () => {
    const addonProduct = products.find(
      p => p.productId === IAP_PRODUCTS.ADDON_10_GENERATIONS
    );

    if (!addonProduct) {
      Alert.alert('エラー', '製品情報を取得できませんでした');
      return;
    }

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
              console.log('Purchase result:', result);

              Alert.alert('購入完了', '10回の追加生成が利用可能になりました');
              await refresh();
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

  const handleRestorePurchases = async () => {
    setPurchasing(true);
    try {
      await restorePurchases();
      Alert.alert('復元完了', '購入が復元されました');
      await refresh();
    } catch (err: any) {
      Alert.alert('復元エラー', err.message);
    } finally {
      setPurchasing(false);
    }
  };

  // ... 既存のUI
}
```

## 完了条件（DoD）

- [ ] react-native-iap がインストールされている
- [ ] IAP接続が初期化される
- [ ] 製品リストが取得できる (Starterサブスクリプション、追加生成)
- [ ] サブスクリプション購入フローが動作する
- [ ] 消費型アイテム購入フローが動作する
- [ ] レシートデータが取得できる
- [ ] 購入キャンセル時に適切なエラーハンドリングがされる
- [ ] 購入の復元機能が動作する
- [ ] Sandboxテスターで購入テストが成功する

## 検証手順

```bash
# 物理iOSデバイスで実行 (Sandbox購入は実機のみ)
cd bananadish-app
npm run ios --device

# 検証手順:
# 1. iOSデバイスの設定でSandboxアカウントを準備
#    設定 > App Store > Sandbox アカウント (サインアウトしておく)
# 2. アプリを起動してログイン
# 3. 設定タブを開く
# 4. 「サブスクリプション管理」をタップ
# 5. 「Starterプランを購入」をタップ
# 6. 価格が ¥1,980/月 と表示されることを確認
# 7. 「購入する」をタップ
# 8. Sandboxログインプロンプトが表示される
# 9. Sandboxテスターアカウントでサインイン
# 10. Touch ID/Face IDで購入確認
# 11. "Environment: Sandbox" の確認ダイアログが表示される
# 12. レシートデータがコンソールに出力されることを確認
# 13. 購入完了アラートが表示されることを確認

# トラブルシューティング:
# - "Cannot connect to iTunes Store" → Sandboxアカウント確認
# - "Product not found" → App Store Connectで製品が「準備完了」か確認
# - "Invalid Product ID" → productIdスペルミス確認
```

## トラブルシューティング

### 問題: 製品が取得できない

**症状**: `getProducts()` が空配列を返す

**解決策**:
```typescript
// 1. App Store Connectで製品ステータス確認
// - 「準備完了」になっているか

// 2. Product IDが正確か確認
console.log('Fetching products:', PRODUCT_IDS);

// 3. Capabilities設定確認
// Xcode → Signing & Capabilities → In-App Purchase が追加されているか

// 4. ビルドを完全にクリーン
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
npm start -- --reset-cache
```

### 問題: Sandbox購入ができない

**症状**: "Cannot connect to iTunes Store"

**解決策**:
```
1. 本番Apple IDからサインアウト
   設定 > [Your Name] > サインアウト (Sandboxテスト中のみ)

2. Sandboxアカウントは購入時にサインイン
   (事前にサインインしない)

3. テストフライトビルドまたはXcode実行ビルドを使用
   (App Storeビルドでは動作しない)

4. ネットワーク接続確認

5. App Store Connectで製品が承認済みか確認
```

### 問題: レシートデータが取得できない

**症状**: `purchase.transactionReceipt` が undefined

**解決策**:
```typescript
// iOS specific: transactionReceipt は base64エンコード済み
console.log('Receipt:', purchase.transactionReceipt);

// Androidの場合は別フィールド
const receipt = Platform.select({
  ios: purchase.transactionReceipt,
  android: purchase.purchaseToken,
});

// レシートが空の場合はトランザクション完了を待つ
if (!receipt) {
  console.log('Waiting for receipt...');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## Deliverables

- `services/iap/purchaseManager.ts` - IAP管理モジュール
- `hooks/useIAP.ts` - IAP カスタムフック
- `constants/iap.ts` - 製品ID定義
- `types/iap.ts` - IAP型定義
- 更新された `app/(tabs)/settings.tsx` - 購入UI

## Notes

- **Sandbox環境**: 実際の課金は発生しない (テスト専用)
- **Receipt検証**: T303でバックエンド検証を実装
- **Transaction finish**: 購入後は必ず `finishTransaction()` を呼ぶ
- **Error handling**: ユーザーキャンセルは正常系として扱う
- **物理デバイス必須**: Sandbox購入はシミュレーターでは動作しない

## 関連ドキュメント

- [react-native-iap 公式ドキュメント](https://react-native-iap.dooboolab.com/)
- [Apple IAP ガイド](https://developer.apple.com/in-app-purchase/)
- [実装計画書 - T302](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t302-react-native-iap-integration)
