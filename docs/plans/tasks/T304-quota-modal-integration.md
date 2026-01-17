# T304-SubTask: ホーム画面へのクォータ超過モーダル統合

## 基本情報
- **タスクID**: T304-SubTask-QuotaModal
- **親タスク**: T304 (Subscription Management UI Implementation)
- **実装対象**: `mobile/app/(tabs)/home.tsx`
- **推定時間**: 30分

## 背景
既存の`UpgradeModal`コンポーネントをホーム画面に統合し、クォータ超過時にユーザーにアップグレードを促す機能を実装します。

## 前提条件
- [x] `UpgradeModal`コンポーネントが`mobile/components/UpgradeModal.tsx`に存在する
- [x] `useSubscriptionContext`が既にインポート済み
- [x] ホーム画面の基本機能が実装済み

## 実装要件

### 変更ファイル
- `/home/noritakasawada/project/20260117/mobile/app/(tabs)/home.tsx`

### 実装内容

#### 1. Importの追加
以下を既存のimport文に追加:
```typescript
import { UpgradeModal } from '../../components/UpgradeModal';
```

#### 2. State変数の追加
既存のstate変数の後に追加:
```typescript
const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
```

#### 3. handleGenerate関数の修正

**変更前 (Line 73-76):**
```typescript
if (!status || status.remaining <= 0) {
  Alert.alert('エラー', '生成回数が残っていません。プランをアップグレードしてください。');
  return;
}
```

**変更後:**
```typescript
if (!status || status.remaining <= 0) {
  setUpgradeModalVisible(true);
  return;
}
```

**変更前 (Line 81-84):**
```typescript
} catch (err) {
  console.error('Generation error:', err);
  Alert.alert('エラー', '画像生成に失敗しました');
}
```

**変更後:**
```typescript
} catch (err: any) {
  console.error('Generation error:', err);
  if (err.code === 'QUOTA_EXCEEDED' || err.message?.includes('QUOTA_EXCEEDED')) {
    setUpgradeModalVisible(true);
  } else {
    Alert.alert('エラー', '画像生成に失敗しました');
  }
}
```

#### 4. JSXへのUpgradeModal追加
`</ScrollView>`の直前(Line 151の前)に追加:
```tsx
<UpgradeModal
  visible={upgradeModalVisible}
  onClose={() => setUpgradeModalVisible(false)}
/>
```

## 完了条件（DoD）

- [ ] `UpgradeModal`が正しくインポートされている
- [ ] `upgradeModalVisible` state変数が追加されている
- [ ] クォータ残り0の場合、Alert.alertではなく`setUpgradeModalVisible(true)`が呼ばれる
- [ ] `QUOTA_EXCEEDED`エラー時にモーダルが表示される
- [ ] UpgradeModalコンポーネントがJSXに追加されている
- [ ] 既存の機能(画像選択、生成、表示)が正常に動作する
- [ ] TypeScriptのコンパイルエラーがない

## 検証手順

### 手動テスト
1. アプリを起動して`home`画面に移動
2. クォータ残り0の状態で「画像を生成」ボタンをタップ
3. UpgradeModalが表示されることを確認
4. モーダルの「キャンセル」ボタンをタップ
5. モーダルが閉じることを確認

### TypeScriptコンパイル確認
```bash
cd /home/noritakasawada/project/20260117/mobile
npx tsc --noEmit
```

## 制約事項
- 既存のコード構造を維持すること
- 他の機能(pickImage, takePhoto, reset等)に影響を与えないこと
- スタイルやレイアウトは変更しないこと
- `useSubscriptionContext`の使用方法は変更しないこと

## 依存関係
- `UpgradeModal`: `/home/noritakasawada/project/20260117/mobile/components/UpgradeModal.tsx`
- `useSubscriptionContext`: 既にインポート済み

## エラーハンドリング
- `err.code`が存在しない場合も考慮して`err.message?.includes('QUOTA_EXCEEDED')`でチェック
- その他のエラーは既存通りAlert.alertで表示

## 成果物
- 修正された`/home/noritakasawada/project/20260117/mobile/app/(tabs)/home.tsx`

---

**実装担当**: Sonnet Task Agent
**レビュー担当**: Opus 4.5 Manager
**作成日**: 2026-01-17
