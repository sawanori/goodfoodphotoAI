# H-2: 認証リダイレクトフロー実装計画

## 概要
認証状態の変更時に適切なリダイレクトを自動実行する仕組みを実装します。

## 目的
- ログイン後に自動的にホーム画面へ遷移
- ログアウト後に自動的にログイン画面へ遷移
- 未認証ユーザーが保護されたルートにアクセスできないようにする

## 影響範囲
- **変更対象ファイル**: `/home/noritakasawada/project/20260117/mobile/app/_layout.tsx`
- **依存コンポーネント**:
  - `contexts/AuthContext.tsx` (既存、変更なし)
  - `expo-router` の `useRouter`, `useSegments` フック

## 技術仕様

### 認証リダイレクトロジック

```typescript
useEffect(() => {
  // ローディング中はリダイレクトを実行しない
  if (loading) return;

  // 現在のルートセグメントを確認
  const inAuthGroup = segments[0] === '(auth)';

  // リダイレクト判定
  if (!user && !inAuthGroup) {
    // 未認証でauth外にいる → ログインへ
    router.replace('/login');
  } else if (user && inAuthGroup) {
    // 認証済みでauth内にいる → ホームへ
    router.replace('/(tabs)/home');
  }
}, [user, loading, segments]);
```

### 実装詳細

#### 1. 必要なインポート追加
```typescript
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
```

#### 2. コンポーネント構造変更
- `RootLayout`コンポーネント内に`RootLayoutNav`子コンポーネントを作成
- `RootLayoutNav`内で認証フックとリダイレクトロジックを実装
- Provider階層構造を維持

#### 3. 実装パターン
```typescript
export default function RootLayout() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <RootLayoutNav />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

## 動作フロー

### ケース1: アプリ起動時（未認証）
1. `AuthProvider`が`loading: true`で初期化
2. Firebase認証状態確認後`loading: false`に変更
3. `user: null`かつ`inAuthGroup: false`（初期位置）
4. → `/login`へリダイレクト

### ケース2: ログイン成功
1. `login()`関数実行でFirebase認証
2. `AuthProvider`の`onAuthStateChanged`で`user`が設定される
3. `user !== null`かつ`inAuthGroup: true`（login画面にいる）
4. → `/(tabs)/home`へリダイレクト

### ケース3: ログアウト
1. `logout()`関数実行でFirebase認証解除
2. `AuthProvider`の`onAuthStateChanged`で`user: null`に設定
3. `user === null`かつ`inAuthGroup: false`（tabs画面から移動）
4. → `/login`へリダイレクト

### ケース4: 認証済みユーザーの再訪問
1. アプリ起動時にFirebaseが既存セッション確認
2. `user`が復元される
3. 初期位置が認証不要エリアの場合、`/(tabs)/home`へリダイレクト

## 注意事項

### リダイレクトループ防止
- `loading`が`true`の間はリダイレクトを実行しない
- これにより初期認証状態確認が完了するまで待機

### Provider階層構造の重要性
- `AuthProvider`が最外層にあるため、`RootLayoutNav`で`useAuth()`が使用可能
- `SubscriptionProvider`も同様に有効

### 既存コードへの影響
- `login.tsx`の31行目`router.replace('/(tabs)/home')`は冗長になるが、UX向上のため残しても問題なし
- 同様に他の画面での手動リダイレクトも維持可能

## テスト観点

### 手動テスト項目
1. 未認証状態でアプリ起動 → ログイン画面表示
2. ログイン成功 → ホーム画面へ自動遷移
3. ログアウト実行 → ログイン画面へ自動遷移
4. 認証済み状態でアプリ再起動 → ホーム画面表示
5. ディープリンクでタブ画面にアクセス（未認証）→ ログイン画面へリダイレクト

### 確認ポイント
- リダイレクトループが発生しないこと
- `loading`中にちらつきがないこと
- 既存のProvider機能（サブスクリプションなど）が正常動作すること

## 実装チェックリスト

- [ ] `useEffect`, `useRouter`, `useSegments`, `useAuth`をインポート
- [ ] `RootLayoutNav`コンポーネントを作成
- [ ] 認証リダイレクトロジックを実装
- [ ] 既存のProvider構造を維持したまま`RootLayoutNav`を配置
- [ ] 手動テストで動作確認

## 完了基準

- [ ] 未認証時にログイン画面へリダイレクトされる
- [ ] ログイン後にホーム画面へリダイレクトされる
- [ ] ログアウト後にログイン画面へリダイレクトされる
- [ ] リダイレクトループが発生しない
- [ ] 既存機能（サブスクリプション、画像生成など）が正常動作する

## 参考資料
- Expo Router Authentication: https://docs.expo.dev/router/reference/authentication/
- Firebase Auth State Persistence: https://firebase.google.com/docs/auth/web/auth-state-persistence
