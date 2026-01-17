# Task: C-1 Create app/index.tsx Entry Point

## Metadata
- **Task ID**: C-1
- **Priority**: Critical
- **Estimated Time**: 15 minutes
- **Dependencies**: None
- **Provides**: `/home/noritakasawada/project/20260117/mobile/app/index.tsx`

## Background

expo-routerのエントリーポイントが不足しています。`app/index.tsx`が存在しないため、アプリが起動しません。このファイルは認証状態をチェックし、適切な画面へリダイレクトする役割を持ちます。

### Current State
- AuthContextが実装済み (`/home/noritakasawada/project/20260117/mobile/contexts/AuthContext.tsx`)
- ルーティング構造が存在:
  - `app/(auth)/login.tsx`: ログイン画面
  - `app/(tabs)/home.tsx`: ホーム画面
- `app/index.tsx`が存在しない

### Design Requirements

以下の仕様に従ってエントリーポイントファイルを作成:

1. **認証状態チェック**: `useAuth()`フックを使用してユーザー状態を取得
2. **ローディング表示**: `loading`がtrueの場合、ActivityIndicatorを表示
3. **リダイレクトロジック**:
   - 未認証 (`!user`): `/login`へリダイレクト
   - 認証済み (`user`): `/(tabs)/home`へリダイレクト

### Implementation Pattern

この実装は**関数コンポーネント**パターンを使用します。

## Implementation Checklist

### [ ] Create app/index.tsx file
- Import必要なモジュール:
  - `Redirect` from `expo-router`
  - `useAuth` from `../contexts/AuthContext`
  - `View`, `ActivityIndicator` from `react-native`
- デフォルトエクスポート関数 `Index` を作成
- `useAuth()`フックから`user`と`loading`を取得
- ローディング時のUI実装 (ActivityIndicator centered)
- 未認証時のリダイレクト実装 (`/login`)
- 認証済み時のリダイレクト実装 (`/(tabs)/home`)

### [ ] Verify implementation
- ファイルが正しいパスに作成されているか確認
- TypeScript型チェックが通るか確認
- インポートパスが正しいか確認

## Operation Verification Methods

### Level: L1 (TypeScript Compilation Check)

```bash
npx tsc --noEmit
```

## Completion Criteria

- [x] `app/index.tsx`ファイルが作成されている
- [x] 認証状態に基づく適切なリダイレクトロジックが実装されている
- [x] ローディング状態の表示が実装されている
- [x] TypeScriptコンパイルエラーがない
- [x] 提供されたサンプルコード構造に従っている

## Reference Code Structure

```typescript
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
```

## Notes

- このファイルはexpo-routerのルートエントリーポイントとして機能します
- AuthProviderは`_layout.tsx`で既に設定されているため、useAuthフックが正常に動作します
- リダイレクトパスは既存のルーティング構造と一致している必要があります
