# T302: React Native IAP Integration - 実装計画書

## 基本情報

| 項目 | 内容 |
|------|------|
| タスクID | T302 |
| タスク名 | React Native IAP Integration |
| 担当モデル | Sonnet (Task agent) |
| 依存タスク | T301 (Apple Developer Setup), T207 (Settings & Profile) |
| 推定時間 | 4-5時間 |
| 作成日 | 2026-01-17 |

## 概要

react-native-iapライブラリを統合し、Apple In-App Purchase (IAP) の購入フローを実装します。サブスクリプション購入、追加生成購入、購入復元機能を含みます。

## 実装方針

### アプローチ

1. **モック実装優先**: Apple Developer Program未登録のため、モックデータでの動作確認を優先
2. **本番対応準備**: 実際のIAP実装も並行して準備（コメントアウトまたは環境変数で切り替え）
3. **段階的実装**: 型定義 → サービスレイヤー → カスタムフック → UI統合の順で実装

### 実装ファイル構成

```
mobile/
├── constants/
│   └── iap.ts                    # 製品ID定義
├── types/
│   └── iap.ts                    # IAP型定義
├── services/
│   └── iap/
│       ├── purchaseManager.ts    # IAP管理モジュール（本番用）
│       └── mockPurchaseManager.ts # モックIAP管理（開発用）
├── hooks/
│   └── useIAP.ts                 # IAPカスタムフック
└── app/(tabs)/
    └── settings.tsx              # 設定画面（購入UI統合）
```

## 詳細実装手順

### Step 1: react-native-iap パッケージインストール

```bash
cd /home/noritakasawada/project/20260117/mobile
npm install react-native-iap@latest
```

**注意事項**:
- iOS の pod install は実機テスト時に実行
- 現時点ではパッケージインストールのみ

### Step 2: IAP製品ID定義 (`constants/iap.ts`)

```typescript
// mobile/constants/iap.ts
export const IAP_PRODUCTS = {
  STARTER_MONTHLY: 'com.bananadish.app.starter.monthly',
  ADDON_10_GENERATIONS: 'com.bananadish.app.boost.10',
} as const;

export const PRODUCT_IDS = Object.values(IAP_PRODUCTS);

export type ProductId = (typeof IAP_PRODUCTS)[keyof typeof IAP_PRODUCTS];

// 製品情報マスタ（価格はローカライズ前の参考値）
export const PRODUCT_INFO = {
  [IAP_PRODUCTS.STARTER_MONTHLY]: {
    name: 'Starterプラン',
    description: '月30回のプロ級写真生成',
    price: '¥1,980',
    period: '月',
    features: [
      '月30回のプロ級写真生成',
      '4種類のアスペクト比対応',
      '高品質JPEG出力',
      'カメラロールに自動保存',
      'いつでもキャンセル可能',
    ],
  },
  [IAP_PRODUCTS.ADDON_10_GENERATIONS]: {
    name: '追加生成 10回',
    description: 'すぐに使える10回の追加生成',
    price: '¥980',
    features: ['今月分として即座に利用可能'],
  },
};
```

**実装理由**:
- 製品IDを一元管理し、タイポを防止
- 製品情報マスタで、モック時のUI表示に使用

### Step 3: IAP型定義 (`types/iap.ts`)

```typescript
// mobile/types/iap.ts
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

// モック用の製品型
export interface MockProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}
```

**実装理由**:
- react-native-iap の型を拡張
- モック実装用の型も定義

### Step 4: モックIAP管理 (`services/iap/mockPurchaseManager.ts`)

```typescript
// mobile/services/iap/mockPurchaseManager.ts
import { IAP_PRODUCTS, PRODUCT_INFO } from '@/constants/iap';
import type { PurchaseResult, PurchaseError, MockProduct } from '@/types/iap';

class MockPurchaseManager {
  private isInitialized = false;

  /**
   * IAP接続を初期化（モック）
   */
  async initialize(): Promise<void> {
    console.log('[MOCK IAP] Initializing...');
    await new Promise(resolve => setTimeout(resolve, 500)); // 初期化をシミュレート
    this.isInitialized = true;
    console.log('[MOCK IAP] Initialized successfully');
  }

  /**
   * IAP接続を切断（モック）
   */
  async dispose(): Promise<void> {
    console.log('[MOCK IAP] Disposing...');
    this.isInitialized = false;
  }

  /**
   * 利用可能な製品を取得（モック）
   */
  async getAvailableProducts(): Promise<{
    subscriptions: MockProduct[];
    products: MockProduct[];
  }> {
    console.log('[MOCK IAP] Fetching products...');
    await new Promise(resolve => setTimeout(resolve, 800));

    const starterInfo = PRODUCT_INFO[IAP_PRODUCTS.STARTER_MONTHLY];
    const addonInfo = PRODUCT_INFO[IAP_PRODUCTS.ADDON_10_GENERATIONS];

    return {
      subscriptions: [
        {
          productId: IAP_PRODUCTS.STARTER_MONTHLY,
          title: starterInfo.name,
          description: starterInfo.description,
          price: starterInfo.price,
          localizedPrice: starterInfo.price,
          currency: 'JPY',
        },
      ],
      products: [
        {
          productId: IAP_PRODUCTS.ADDON_10_GENERATIONS,
          title: addonInfo.name,
          description: addonInfo.description,
          price: addonInfo.price,
          localizedPrice: addonInfo.price,
          currency: 'JPY',
        },
      ],
    };
  }

  /**
   * サブスクリプション購入（モック）
   */
  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    console.log(`[MOCK IAP] Purchasing subscription: ${productId}`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // モックレシートデータ（Base64エンコード文字列）
    const mockReceipt = btoa(JSON.stringify({
      productId,
      transactionId: `mock_${Date.now()}`,
      purchaseDate: new Date().toISOString(),
      environment: 'Mock',
    }));

    return {
      success: true,
      transactionId: `mock_txn_${Date.now()}`,
      receiptData: mockReceipt,
      productId,
    };
  }

  /**
   * 消費型アイテム購入（モック）
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    console.log(`[MOCK IAP] Purchasing product: ${productId}`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockReceipt = btoa(JSON.stringify({
      productId,
      transactionId: `mock_${Date.now()}`,
      purchaseDate: new Date().toISOString(),
      environment: 'Mock',
    }));

    return {
      success: true,
      transactionId: `mock_txn_${Date.now()}`,
      receiptData: mockReceipt,
      productId,
    };
  }

  /**
   * 購入の復元（モック）
   */
  async restorePurchases(): Promise<any[]> {
    console.log('[MOCK IAP] Restoring purchases...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [];
  }

  /**
   * エラーハンドリング（モック）
   */
  private handlePurchaseError(error: any): PurchaseError {
    return {
      code: 'MOCK_ERROR',
      message: 'モック購入エラー',
      userCancelled: false,
    };
  }
}

export const mockPurchaseManager = new MockPurchaseManager();
```

**実装理由**:
- Apple Developer未登録でも動作確認可能
- 実際の購入フローをシミュレート
- Base64エンコードされたモックレシートを生成

### Step 5: 本番IAP管理 (`services/iap/purchaseManager.ts`)

タスクファイルT302-iap-integration.mdのStep 4のコードをそのまま実装します。

**注意事項**:
- 現時点ではコメントアウトまたは環境変数で無効化
- 実機テスト時に有効化

### Step 6: useIAP カスタムフック (`hooks/useIAP.ts`)

```typescript
// mobile/hooks/useIAP.ts
import { useState, useEffect } from 'react';
import { mockPurchaseManager } from '@/services/iap/mockPurchaseManager';
// import { purchaseManager } from '@/services/iap/purchaseManager'; // 本番用
import type { MockProduct, PurchaseResult } from '@/types/iap';

// 環境変数でモック/本番を切り替え（今は常にモック）
const USE_MOCK_IAP = true;
const iapManager = USE_MOCK_IAP ? mockPurchaseManager : null; // 本番時は purchaseManager

interface UseIAPReturn {
  products: MockProduct[];
  subscriptions: MockProduct[];
  loading: boolean;
  error: string | null;
  purchaseProduct: (productId: string) => Promise<PurchaseResult>;
  purchaseSubscription: (productId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<void>;
}

export const useIAP = (): UseIAPReturn => {
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [subscriptions, setSubscriptions] = useState<MockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeIAP();

    return () => {
      if (iapManager) {
        iapManager.dispose();
      }
    };
  }, []);

  const initializeIAP = async () => {
    if (!iapManager) {
      setError('IAP manager not configured');
      setLoading(false);
      return;
    }

    try {
      await iapManager.initialize();
      const { subscriptions: subs, products: prods } =
        await iapManager.getAvailableProducts();

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
    if (!iapManager) {
      throw new Error('IAP manager not configured');
    }
    try {
      const result = await iapManager.purchaseProduct(productId);
      return result;
    } catch (err: any) {
      throw err;
    }
  };

  const purchaseSubscription = async (
    productId: string
  ): Promise<PurchaseResult> => {
    if (!iapManager) {
      throw new Error('IAP manager not configured');
    }
    try {
      const result = await iapManager.purchaseSubscription(productId);
      return result;
    } catch (err: any) {
      throw err;
    }
  };

  const restorePurchases = async (): Promise<void> => {
    if (!iapManager) {
      throw new Error('IAP manager not configured');
    }
    try {
      const purchases = await iapManager.restorePurchases();
      console.log('Purchases restored:', purchases);
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

**実装理由**:
- モック/本番の切り替えを一元管理
- 初期化とクリーンアップを自動化
- エラーハンドリングを統一

### Step 7: 設定画面への統合 (`app/(tabs)/settings.tsx`)

既存の設定画面に購入UIを追加します。

```typescript
// app/(tabs)/settings.tsx に追加
import { useIAP } from '@/hooks/useIAP';
import { IAP_PRODUCTS } from '@/constants/iap';
import { Alert } from 'react-native';

// 既存のコンポーネント内に追加
export default function SettingsScreen() {
  // 既存のフック
  // const { user, signOut } = useAuth();
  // const { subscription, loading, error, refresh } = useSubscription();

  // 新規追加
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

              // モック環境では即座に成功
              Alert.alert('購入完了', 'Starterプランに登録されました（モック環境）');
              // 本番環境ではT303のレシート検証を実行
            } catch (err: any) {
              Alert.alert('購入エラー', err.message);
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

              Alert.alert('購入完了', '10回の追加生成が利用可能になりました（モック環境）');
            } catch (err: any) {
              Alert.alert('購入エラー', err.message);
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
      Alert.alert('復元完了', '購入が復元されました（モック環境）');
    } catch (err: any) {
      Alert.alert('復元エラー', err.message);
    } finally {
      setPurchasing(false);
    }
  };

  // 既存のUIに以下のボタンを追加
  return (
    <View>
      {/* 既存のUI */}

      {/* 購入ボタン追加 */}
      <TouchableOpacity onPress={handlePurchaseStarter} disabled={purchasing || iapLoading}>
        <Text>Starterプランを購入</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handlePurchaseAddon} disabled={purchasing || iapLoading}>
        <Text>追加生成を購入</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestorePurchases} disabled={purchasing}>
        <Text>購入の復元</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**実装理由**:
- 既存のT207設定画面に購入機能を統合
- モック環境でも購入フローをテスト可能
- Alert確認ダイアログでユーザー体験を向上

## 完了条件（DoD）

- [ ] react-native-iap パッケージがインストールされている
- [ ] `constants/iap.ts` で製品ID定義済み
- [ ] `types/iap.ts` で型定義済み
- [ ] `services/iap/mockPurchaseManager.ts` でモックIAP実装済み
- [ ] `hooks/useIAP.ts` でカスタムフック実装済み
- [ ] `app/(tabs)/settings.tsx` に購入UI統合済み
- [ ] モック環境で購入フローが動作する
- [ ] コンソールにログが正しく出力される
- [ ] アラートで購入成功・失敗が表示される

## 検証手順

```bash
# 1. パッケージインストール確認
cd /home/noritakasawada/project/20260117/mobile
npm list react-native-iap

# 2. 型チェック
npm run type-check

# 3. アプリ起動（シミュレーター）
npm run ios

# 4. 動作確認
# - 設定画面を開く
# - 「Starterプランを購入」をタップ
# - 確認ダイアログが表示される
# - 「購入する」をタップ
# - コンソールに [MOCK IAP] ログが出力される
# - 購入完了アラートが表示される

# 5. 追加生成購入も同様にテスト

# 6. 購入復元もテスト
```

## トラブルシューティング

### 問題: react-native-iap のインストールエラー

**症状**: npm install で失敗

**解決策**:
```bash
# キャッシュクリア
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 問題: 型エラー

**症状**: TypeScript型エラー

**解決策**:
```bash
# 型定義確認
npm run type-check

# react-native-iap の型定義確認
npm list @types/react-native-iap
```

### 問題: モックが動作しない

**症状**: 製品情報が表示されない

**解決策**:
```typescript
// useIAP.ts のログ確認
console.log('IAP Manager:', iapManager);
console.log('Products:', products);
console.log('Subscriptions:', subscriptions);
```

## 次のステップ

T302完了後、T303（レシート検証）でバックエンド連携を実装します。

## 関連ドキュメント

- [T302タスクファイル](/home/noritakasawada/project/20260117/docs/plans/tasks/T302-iap-integration.md)
- [react-native-iap 公式ドキュメント](https://react-native-iap.dooboolab.com/)
