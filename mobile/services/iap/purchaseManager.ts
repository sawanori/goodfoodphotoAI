// モック実装: react-native-iapが未インストールのため
// 実際の環境では react-native-iap をインストールしてこのファイルを置き換えてください

export interface Purchase {
  productId: string;
  transactionId: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
}

export interface Product {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
  localizedPrice: string;
}

export const PRODUCT_IDS = {
  STARTER_MONTHLY: 'com.bananadish.app.starter.monthly',
  BOOST_10: 'com.bananadish.app.boost.10',
} as const;

class PurchaseManager {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      // モック: 実際は RNIap.initConnection()
      console.log('[Mock] IAP connection initialized');
      this.initialized = true;
    } catch (error) {
      console.error('IAP init error:', error);
      throw error;
    }
  }

  async getProducts(): Promise<Product[]> {
    await this.init();
    // モック: 実際は RNIap.getSubscriptions()
    return [
      {
        productId: PRODUCT_IDS.STARTER_MONTHLY,
        price: '1980',
        currency: 'JPY',
        title: 'スターター月額プラン',
        description: '月に50回まで画像生成可能',
        localizedPrice: '¥1,980',
      },
    ];
  }

  async getConsumables(): Promise<Product[]> {
    await this.init();
    // モック: 実際は RNIap.getProducts()
    return [
      {
        productId: PRODUCT_IDS.BOOST_10,
        price: '300',
        currency: 'JPY',
        title: 'ブースト 10回分',
        description: '追加で10回の画像生成が可能',
        localizedPrice: '¥300',
      },
    ];
  }

  async purchaseSubscription(): Promise<Purchase> {
    await this.init();
    // モック: 実際は RNIap.requestSubscription()
    console.log('[Mock] Subscription purchase requested');

    // テスト用のダミーレシート
    return {
      productId: PRODUCT_IDS.STARTER_MONTHLY,
      transactionId: `mock_sub_${Date.now()}`,
      transactionDate: Date.now(),
      transactionReceipt: btoa(JSON.stringify({
        product_id: PRODUCT_IDS.STARTER_MONTHLY,
        transaction_id: `mock_sub_${Date.now()}`,
        purchase_date: new Date().toISOString(),
      })),
    };
  }

  async purchaseBoost(): Promise<Purchase> {
    await this.init();
    // モック: 実際は RNIap.requestPurchase()
    console.log('[Mock] Boost purchase requested');

    return {
      productId: PRODUCT_IDS.BOOST_10,
      transactionId: `mock_boost_${Date.now()}`,
      transactionDate: Date.now(),
      transactionReceipt: btoa(JSON.stringify({
        product_id: PRODUCT_IDS.BOOST_10,
        transaction_id: `mock_boost_${Date.now()}`,
        purchase_date: new Date().toISOString(),
      })),
    };
  }

  async restorePurchases(): Promise<Purchase[]> {
    await this.init();
    // モック: 実際は RNIap.getAvailablePurchases()
    console.log('[Mock] Restore purchases requested');
    return [];
  }

  async finishTransaction(purchase: Purchase): Promise<void> {
    // モック: 実際は RNIap.finishTransaction()
    console.log('[Mock] Transaction finished:', purchase.transactionId);
  }

  async endConnection(): Promise<void> {
    // モック: 実際は RNIap.endConnection()
    console.log('[Mock] IAP connection ended');
    this.initialized = false;
  }
}

export const purchaseManager = new PurchaseManager();
