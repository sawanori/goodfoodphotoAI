# T304 実装委託記録

## 委託情報

- **委託日時**: 2026-01-17
- **委託元**: Claude Opus 4.5 (Manager/Orchestrator)
- **委託先**: Claude Sonnet 4.5 (Implementation Agent)
- **タスクID**: T304
- **タスク名**: 設定画面の拡張実装

## 委託内容

### 実装対象ファイル
`/home/noritakasawada/project/20260117/mobile/app/(tabs)/settings.tsx`

### 実装内容サマリー
サブスクリプション管理機能の追加:
1. SubscriptionCardコンポーネント統合
2. UpgradeModal統合
3. 購入復元機能実装

### 参照ドキュメント
- 実装計画書: `/home/noritakasawada/project/20260117/docs/plans/t304-settings-screen-extension-plan.md`
- タスク詳細: `/tmp/t304_implementation_task.md`

## 実装指示

実装エージェントは以下を実行すること:

### Phase 1: Import追加
```typescript
import { useState } from 'react';
import { SubscriptionCard } from '../../components/SubscriptionCard';
import { UpgradeModal } from '../../components/UpgradeModal';
import { useSubscriptionContext } from '../../contexts/SubscriptionContext';
// ActivityIndicatorを既存のreact-native importに追加
```

### Phase 2: State管理追加
```typescript
export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // 追加
  const { status, loading: subLoading, restorePurchases } = useSubscriptionContext();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
```

### Phase 3: ハンドラー実装
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

### Phase 4: JSX拡張
アカウント情報セクションの後、アプリについてセクションの前に挿入:
```tsx
{/* サブスクリプションセクション */}
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

      {status?.tier === 'free' && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => setUpgradeModalVisible(true)}
        >
          <Text style={styles.upgradeButtonText}>プランをアップグレード</Text>
        </TouchableOpacity>
      )}

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
```

### Phase 5: Modal追加
ScrollViewの外、return文の最後に追加:
```tsx
<UpgradeModal
  visible={upgradeModalVisible}
  onClose={() => setUpgradeModalVisible(false)}
/>
```

### Phase 6: スタイル追加
StyleSheet.createの中に追加:
```typescript
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
```

## 完了確認項目

実装エージェントは以下をすべて確認すること:

- [ ] TypeScriptコンパイルエラーがない
- [ ] すべてのimportが正しく追加されている
- [ ] 既存機能（ログアウト）が維持されている
- [ ] エラーハンドリングが実装されている
- [ ] ローディング状態が適切に管理されている
- [ ] 条件付きレンダリング（free tierチェック）が動作する
- [ ] 全テキストが日本語である
- [ ] コードフォーマットが統一されている

## 品質基準

- TypeScript型安全性: 100%
- エラーハンドリング: すべてのAsync処理でtry-catch実装
- 日本語化: すべてのユーザー向けテキスト
- 既存機能維持: 既存コードに影響なし

## 次のステップ

実装完了後:
1. マネージャーに完了報告
2. 動作確認結果の報告
3. 必要に応じて修正対応

---

**委託者**: Claude Opus 4.5 (Manager)
**記録日時**: 2026-01-17
