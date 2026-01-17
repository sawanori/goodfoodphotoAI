# T304: 設定画面の拡張実装 - 実装計画書

## タスク概要

**タスクID**: T304
**タスク名**: 設定画面の拡張実装
**優先度**: 高
**作成日**: 2026-01-17
**担当モデル**: Claude Sonnet 4.5 (Task Agent)

## 背景と目的

### 背景
BananaDishアプリのPhase 3 (Payment Integration) の最終仕上げとして、設定画面にサブスクリプション管理機能を追加します。

### 目的
`mobile/app/(tabs)/settings.tsx` を拡張し、以下の機能を追加:
1. SubscriptionCardコンポーネントの統合（現在のプラン表示）
2. アップグレードボタン（UpgradeModalを開く）
3. 購入復元ボタン

## 既存コンポーネント確認

以下の既存コンポーネントを使用します:

### 1. SubscriptionCard (`mobile/components/SubscriptionCard.tsx`)
- Props: `onUpgradePress?: () => void`
- 機能: サブスクリプション情報表示（プラン、使用状況、更新日など）
- 状態管理: `useSubscriptionContext()` から状態取得

### 2. UpgradeModal (`mobile/components/UpgradeModal.tsx`)
- Props: `visible: boolean`, `onClose: () => void`
- 機能: スタータープランへのアップグレード画面表示
- 機能: 商品情報取得、購入処理実行

### 3. SubscriptionContext (`mobile/contexts/SubscriptionContext.tsx`)
- 提供機能:
  - `status`: SubscriptionStatus | null
  - `loading`: boolean
  - `error`: string | null
  - `refresh()`: Promise<void>
  - `purchaseSubscription()`: Promise<{success, error?}>
  - `purchaseBoost()`: Promise<{success, error?}>
  - `restorePurchases()`: Promise<{success, count?, error?}>

## 実装手順

### ステップ1: Import追加

```typescript
import { SubscriptionCard } from '../../components/SubscriptionCard';
import { UpgradeModal } from '../../components/UpgradeModal';
import { useSubscriptionContext } from '../../contexts/SubscriptionContext';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native'; // 既存に追加
```

### ステップ2: コンポーネント内の状態追加

```typescript
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // 追加: サブスクリプション関連の状態
  const { status, loading: subLoading, restorePurchases } = useSubscriptionContext();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  // 既存のhandleLogout...
```

### ステップ3: 購入復元ハンドラー追加

```typescript
const handleRestorePurchases = async () => {
  try {
    setRestoringPurchases(true);
    const result = await restorePurchases();

    if (result.success) {
      Alert.alert(
        '復元完了',
        result.count && result.count > 0
          ? `${result.count}件の購入を復元しました`
          : '復元できる購入はありませんでした'
      );
    } else {
      Alert.alert('エラー', result.error || '購入の復元に失敗しました');
    }
  } catch (error) {
    Alert.alert(
      'エラー',
      error instanceof Error ? error.message : '購入の復元中にエラーが発生しました'
    );
  } finally {
    setRestoringPurchases(false);
  }
};
```

### ステップ4: JSX構造の変更

アカウント情報セクションの下に、サブスクリプションセクションを追加:

```tsx
<ScrollView style={styles.container}>
  <View style={styles.content}>
    <Text style={styles.title}>設定</Text>

    {/* 既存: アカウント情報セクション */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>アカウント情報</Text>
      <View style={styles.infoCard}>
        <Text style={styles.label}>メールアドレス</Text>
        <Text style={styles.value}>{user?.email || '未設定'}</Text>
      </View>
    </View>

    {/* 新規: サブスクリプションセクション */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>サブスクリプション</Text>
      {subLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <>
          <SubscriptionCard
            onUpgradePress={() => setUpgradeModalVisible(true)}
          />

          {/* free tierの場合のみアップグレードボタン表示 */}
          {status?.tier === 'free' && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => setUpgradeModalVisible(true)}
            >
              <Text style={styles.upgradeButtonText}>プランをアップグレード</Text>
            </TouchableOpacity>
          )}

          {/* 購入復元ボタン */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
            disabled={restoringPurchases}
          >
            {restoringPurchases ? (
              <ActivityIndicator color="#FF6B35" />
            ) : (
              <Text style={styles.restoreButtonText}>購入の復元</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>

    {/* 既存: アプリについてセクション */}
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>アプリについて</Text>
      <View style={styles.infoCard}>
        <Text style={styles.label}>バージョン</Text>
        <Text style={styles.value}>1.0.0</Text>
      </View>
    </View>

    {/* 既存: ログアウトボタン */}
    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
      <Text style={styles.logoutButtonText}>ログアウト</Text>
    </TouchableOpacity>
  </View>
</ScrollView>

{/* UpgradeModal */}
<UpgradeModal
  visible={upgradeModalVisible}
  onClose={() => setUpgradeModalVisible(false)}
/>
```

### ステップ5: スタイル追加

```typescript
const styles = StyleSheet.create({
  // 既存スタイル...

  // 新規追加
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  upgradeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
    marginTop: 12,
  },
  restoreButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
});
```

## 完了条件チェックリスト

- [ ] 設定画面でサブスクリプション情報が表示される
- [ ] SubscriptionCardコンポーネントが正しく統合されている
- [ ] free tierの場合のみ「プランをアップグレード」ボタンが表示される
- [ ] アップグレードボタンをタップするとUpgradeModalが開く
- [ ] 購入復元ボタンが実装されている
- [ ] 購入復元ボタンをタップすると`restorePurchases`が呼ばれる
- [ ] ローディング中はActivityIndicatorが表示される
- [ ] エラー時に適切なAlert表示がある
- [ ] 既存のログアウト機能が正常に動作する
- [ ] 全テキストが日本語である

## 技術的注意事項

### 1. エラーハンドリング
- `restorePurchases()` 実行時のエラーをtry-catchで捕捉
- エラーメッセージはAlertで日本語表示

### 2. ローディング状態管理
- サブスクリプション情報読み込み中: `subLoading` (SubscriptionContextから取得)
- 購入復元処理中: `restoringPurchases` (ローカルstate)

### 3. 条件付きレンダリング
- free tierの場合のみアップグレードボタン表示: `status?.tier === 'free'`
- SubscriptionCardは常に表示（内部で状態に応じた表示を制御）

### 4. 既存機能の維持
- ログアウト機能は変更なし
- アカウント情報表示は変更なし
- アプリバージョン表示は変更なし

## リスクと対策

### リスク1: SubscriptionProviderが設定されていない
**対策**: `_layout.tsx`でSubscriptionProviderがラップされているか確認

### リスク2: 購入復元が実機でのみ動作
**対策**: 開発環境ではモック/シミュレーターでテスト、実機でも動作確認を推奨

## テスト項目

### 1. 表示テスト
- サブスクリプション情報が正しく表示される
- free tierの場合、アップグレードボタンが表示される
- starter tierの場合、アップグレードボタンが非表示になる

### 2. 機能テスト
- アップグレードボタンタップでUpgradeModalが開く
- モーダルの閉じるボタンで正常に閉じる
- 購入復元ボタンで`restorePurchases`が呼ばれる
- ローディング中はボタンが無効化される

### 3. エラーハンドリングテスト
- restorePurchases失敗時にエラーAlertが表示される
- ネットワークエラー時の挙動確認

## 実装ファイル

- **対象ファイル**: `/home/noritakasawada/project/20260117/mobile/app/(tabs)/settings.tsx`
- **変更種別**: 機能拡張（既存機能は維持）
- **推定行数**: 約80行追加（import, state, handlers, JSX, styles含む）

## 関連ドキュメント

- SubscriptionCard実装: `/home/noritakasawada/project/20260117/mobile/components/SubscriptionCard.tsx`
- UpgradeModal実装: `/home/noritakasawada/project/20260117/mobile/components/UpgradeModal.tsx`
- SubscriptionContext: `/home/noritakasawada/project/20260117/mobile/contexts/SubscriptionContext.tsx`

## 次のステップ

実装完了後:
1. 開発サーバーで動作確認
2. free tier / starter tierでの表示確認
3. 購入復元機能のテスト
4. エラーハンドリングの確認
5. 実機での動作確認（可能であれば）

---

**計画作成日**: 2026-01-17
**計画作成者**: Claude Opus 4.5 (Manager)
**実装担当**: Claude Sonnet 4.5 (Task Agent)
