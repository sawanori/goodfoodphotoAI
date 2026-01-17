# T207: Settings & Profile Screen Implementation

## 基本情報
- **タスクID**: T207
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**: T203 (Authentication UI & Firebase Integration)
- **成果物**:
  - Settings画面 (`app/(tabs)/settings.tsx`)
  - SubscriptionCardコンポーネント
  - Subscription API クライアント
  - SubscriptionContext
  - useSubscription カスタムフック
- **推定時間**: 3-4時間

## 概要
ユーザーのプロフィール情報、サブスクリプション状況、使用状況を表示する設定画面を実装します。ログアウト機能、プライバシーポリシー/利用規約へのリンク、サブスクリプション管理(プレースホルダー)を含みます。

## 前提条件
- [ ] T203が完了し、AuthContextが実装されている
- [ ] Firebase Authenticationが動作している
- [ ] バックエンドAPI (T107) がデプロイされている
- [ ] GET /v1/subscription/status エンドポイントが利用可能

## 実装手順

### Step 1: Subscription型定義の作成

`types/subscription.ts` を作成:

```typescript
export type SubscriptionTier = 'free' | 'starter';
export type SubscriptionStatus = 'active' | 'inactive' | 'expired';

export interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  limit: number;
  used: number;
  remaining: number;
  renewsAt: string | null; // ISO 8601 date string
  addOns: string[];
}

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  percentage: number; // 0-100
}

export const getTierDisplayName = (tier: SubscriptionTier): string => {
  switch (tier) {
    case 'free':
      return '無料プラン';
    case 'starter':
      return 'Starterプラン';
    default:
      return '不明';
  }
};

export const getUsagePercentage = (used: number, limit: number): number => {
  if (limit === 0) return 0;
  return Math.round((used / limit) * 100);
};
```

### Step 2: Subscription API クライアントの実装

`services/api/subscription.ts` を作成:

```typescript
import { SubscriptionData } from '@/types/subscription';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

export class SubscriptionAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'SubscriptionAPIError';
  }
}

/**
 * サブスクリプション状態を取得
 */
export const fetchSubscriptionStatus = async (
  idToken: string
): Promise<SubscriptionData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/subscription/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new SubscriptionAPIError(
        errorData.message || 'サブスクリプション情報の取得に失敗しました',
        errorData.code || 'FETCH_FAILED',
        response.status
      );
    }

    const data: SubscriptionData = await response.json();
    return data;
  } catch (error) {
    if (error instanceof SubscriptionAPIError) {
      throw error;
    }

    // Network errors
    throw new SubscriptionAPIError(
      'ネットワークエラーが発生しました',
      'NETWORK_ERROR',
      0
    );
  }
};

/**
 * サブスクリプション情報をリフレッシュ
 */
export const refreshSubscription = async (
  idToken: string
): Promise<SubscriptionData> => {
  return fetchSubscriptionStatus(idToken);
};
```

### Step 3: SubscriptionContext の実装

`contexts/SubscriptionContext.tsx` を作成:

```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';
import { SubscriptionData } from '@/types/subscription';
import { fetchSubscriptionStatus } from '@/services/api/subscription';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { idToken } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!idToken) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchSubscriptionStatus(idToken);
      setSubscription(data);
    } catch (err: any) {
      console.error('Subscription fetch error:', err);
      setError(err.message || 'サブスクリプション情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [idToken]);

  const refresh = async () => {
    await fetchData();
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};
```

### Step 4: SubscriptionCard コンポーネントの作成

`components/SubscriptionCard.tsx` を作成:

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscriptionData, getTierDisplayName, getUsagePercentage } from '@/types/subscription';

interface SubscriptionCardProps {
  subscription: SubscriptionData;
  onManagePress?: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  onManagePress,
}) => {
  const usagePercentage = getUsagePercentage(subscription.used, subscription.limit);
  const tierName = getTierDisplayName(subscription.tier);

  const formatRenewalDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.tierName}>{tierName}</Text>
          <Text style={styles.status}>
            {subscription.status === 'active' ? '利用中' : '未契約'}
          </Text>
        </View>
        <Ionicons
          name={subscription.tier === 'starter' ? 'star' : 'star-outline'}
          size={32}
          color={subscription.tier === 'starter' ? '#FFD700' : '#ccc'}
        />
      </View>

      <View style={styles.usageSection}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageLabel}>今月の使用状況</Text>
          <Text style={styles.usageCount}>
            {subscription.used} / {subscription.limit} 回
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(usagePercentage, 100)}%`,
                backgroundColor: usagePercentage >= 100 ? '#FF3B30' : '#007AFF',
              },
            ]}
          />
        </View>

        <Text style={styles.remainingText}>
          残り {subscription.remaining} 回
        </Text>
      </View>

      {subscription.renewsAt && (
        <View style={styles.renewalSection}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.renewalText}>
            更新日: {formatRenewalDate(subscription.renewsAt)}
          </Text>
        </View>
      )}

      {onManagePress && (
        <TouchableOpacity style={styles.manageButton} onPress={onManagePress}>
          <Text style={styles.manageButtonText}>サブスクリプション管理</Text>
          <Ionicons name="chevron-forward" size={20} color="#007AFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#007AFF',
  },
  usageSection: {
    marginBottom: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    color: '#666',
  },
  usageCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 12,
    color: '#666',
  },
  renewalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  renewalText: {
    fontSize: 14,
    color: '#666',
  },
  manageButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  manageButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
```

### Step 5: Settings画面の実装

`app/(tabs)/settings.tsx` を更新:

```typescript
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionCard } from '@/components/SubscriptionCard';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { subscription, loading, error, refresh } = useSubscription();

  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか?', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('エラー', 'ログアウトに失敗しました');
          }
        },
      },
    ]);
  };

  const handleManageSubscription = () => {
    Alert.alert('準備中', 'サブスクリプション管理機能は次のフェーズで実装されます');
  };

  const handleRestorePurchases = () => {
    Alert.alert('準備中', '購入の復元機能は次のフェーズで実装されます');
  };

  const openURL = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('エラー', 'URLを開けませんでした');
    }
  };

  if (loading && !subscription) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      {/* User Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アカウント</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={32} color="#007AFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.displayName || '名前未設定'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
        </View>
      </View>

      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サブスクリプション</Text>
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>再試行</Text>
            </TouchableOpacity>
          </View>
        ) : subscription ? (
          <SubscriptionCard
            subscription={subscription}
            onManagePress={handleManageSubscription}
          />
        ) : (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>サブスクリプション情報を取得できません</Text>
          </View>
        )}
      </View>

      {/* Subscription Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={handleRestorePurchases}>
          <Ionicons name="refresh-outline" size={24} color="#007AFF" />
          <Text style={styles.menuItemText}>購入の復元</Text>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>法的情報</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => openURL('https://bananadish.app/privacy')}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color="#666" />
          <Text style={styles.menuItemText}>プライバシーポリシー</Text>
          <Ionicons name="open-outline" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => openURL('https://bananadish.app/terms')}
        >
          <Ionicons name="document-text-outline" size={24} color="#666" />
          <Text style={styles.menuItemText}>利用規約</Text>
          <Ionicons name="open-outline" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={styles.logoutButtonText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>BananaDish v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  errorCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  versionContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
```

### Step 6: SubscriptionProviderをアプリに統合

`app/_layout.tsx` を更新:

```typescript
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
```

## 完成コード

上記のStep 1-6を実装すると、以下の機能が完成します:

- ユーザープロフィール表示 (名前、メールアドレス)
- サブスクリプションカード (プラン、使用状況、更新日)
- 使用状況プログレスバー
- サブスクリプション管理ボタン (プレースホルダー)
- 購入の復元ボタン (プレースホルダー)
- プライバシーポリシー/利用規約リンク
- ログアウト機能
- アプリバージョン表示

## 完了条件（DoD）

- [ ] Settings画面が正しくレンダリングされる
- [ ] ユーザー情報 (メール、名前) が表示される
- [ ] サブスクリプション情報がAPIから取得される
- [ ] 使用状況がプログレスバーで視覚的に表示される
- [ ] 残り回数が正確に計算されて表示される
- [ ] ログアウトボタンが機能する
- [ ] ログアウト時に確認ダイアログが表示される
- [ ] プライバシーポリシー/利用規約リンクが外部ブラウザで開く
- [ ] APIエラー時にエラーメッセージが表示される
- [ ] 再試行ボタンでサブスクリプション情報を再取得できる
- [ ] ローディング中にインジケーターが表示される

## 検証手順

```bash
# iOS Simulatorで実行
cd bananadish-app
npm run ios

# 検証手順:
# 1. アプリにログインする
# 2. 設定タブをタップ
# 3. ユーザー情報が表示されることを確認
# 4. サブスクリプションカードが表示されることを確認
# 5. 使用状況が正しく表示されることを確認 (例: 0 / 10 回)
# 6. プログレスバーが適切な幅で表示されることを確認
# 7. 「サブスクリプション管理」ボタンをタップ → プレースホルダーアラート確認
# 8. 「購入の復元」ボタンをタップ → プレースホルダーアラート確認
# 9. プライバシーポリシーリンクをタップ → ブラウザが開くことを確認
# 10. ログアウトボタンをタップ
# 11. 確認ダイアログが表示されることを確認
# 12. 「ログアウト」を選択 → ログイン画面に遷移することを確認

# APIエラーテスト:
# - バックエンドを停止してアプリをリロード
# - エラーメッセージが表示されることを確認
# - 「再試行」ボタンをタップして再取得を確認
```

## トラブルシューティング

### 問題: サブスクリプション情報が取得できない

**症状**: ローディング後にエラーメッセージが表示される

**解決策**:
```bash
# APIエンドポイントの確認
console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);

# IDトークンの確認
console.log('ID Token:', idToken?.substring(0, 20));

# cURLでAPIをテスト
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.run.app/v1/subscription/status

# ネットワークタブでリクエストを確認
# Chrome DevTools → Network タブで確認
```

### 問題: 使用状況が更新されない

**症状**: 生成後も使用カウントが変わらない

**解決策**:
```typescript
// 生成成功後にサブスクリプションをリフレッシュ
const { refresh } = useSubscription();

const handleGenerationComplete = async () => {
  // ... 生成処理
  await refresh(); // サブスクリプション情報を再取得
};

// または、SubscriptionContextでポーリング
useEffect(() => {
  const interval = setInterval(() => {
    refresh();
  }, 30000); // 30秒ごと

  return () => clearInterval(interval);
}, []);
```

### 問題: プログレスバーが正しく表示されない

**症状**: 使用率が100%を超えて表示される

**解決策**:
```typescript
// getUsagePercentage関数で100%でクリップ
export const getUsagePercentage = (used: number, limit: number): number => {
  if (limit === 0) return 0;
  const percentage = (used / limit) * 100;
  return Math.min(Math.round(percentage), 100); // 100%でキャップ
};

// スタイルでも念のためクリップ
<View
  style={[
    styles.progressBar,
    { width: `${Math.min(usagePercentage, 100)}%` }
  ]}
/>
```

### 問題: ログアウト後もユーザー情報が残る

**症状**: ログアウト後に設定画面に戻るとユーザー情報が表示される

**解決策**:
```typescript
// AuthContextでサインアウト時に状態をクリア
const signOut = async () => {
  await auth().signOut();
  setUser(null);
  setIdToken(null);
};

// SubscriptionContextでも状態をクリア
useEffect(() => {
  if (!idToken) {
    setSubscription(null);
  }
}, [idToken]);
```

### 問題: 外部リンクが開かない

**症状**: プライバシーポリシーをタップしても何も起きない

**解決策**:
```typescript
import { Linking, Alert } from 'react-native';

const openURL = async (url: string) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('エラー', 'このURLを開けません');
    }
  } catch (error) {
    console.error('Failed to open URL:', error);
    Alert.alert('エラー', 'URLを開く際にエラーが発生しました');
  }
};

// app.jsonでURLスキームが設定されていることを確認
// "scheme": "bananadish"
```

## Deliverables

- `types/subscription.ts` - サブスクリプション型定義
- `services/api/subscription.ts` - Subscription API クライアント
- `contexts/SubscriptionContext.tsx` - サブスクリプション状態管理
- `components/SubscriptionCard.tsx` - サブスクリプションカードコンポーネント
- `app/(tabs)/settings.tsx` - 設定画面 (完成版)

## Notes

- **Phase 3準備**: サブスクリプション管理/購入復元ボタンはプレースホルダーとし、T304で実装
- **UX考慮**: 使用状況を視覚的に表示し、残り回数を明確に伝える
- **Error Handling**: API障害時にも基本情報 (ユーザー名、メール) は表示可能にする
- **Accessibility**: VoiceOver対応、Dynamic Type対応
- **Performance**: サブスクリプション情報はコンテキストでキャッシュし、不要な再取得を避ける

## 関連ドキュメント

- [技術設計書 - Settings Screen](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#key-screen-specifications)
- [実装計画書 - T207](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t207-settings--profile-screen-implementation)
- [実装計画書 - Subscription API](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#get-v1subscriptionstatus)
