# T202: Navigation & Routing Implementation

## 基本情報
- **タスクID**: T202
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**: T201 (React Native Project Setup)
- **成果物**:
  - `app/(auth)/login.tsx`
  - `app/(auth)/signup.tsx`
  - `app/(auth)/_layout.tsx`
  - `app/onboarding.tsx`
  - `app/_layout.tsx` (更新)
  - `app/(tabs)/_layout.tsx` (更新)
- **推定時間**: 2-3時間

## 概要
Expo Routerを使用してファイルベースのルーティングを実装し、認証フロー、オンボーディング、タブナビゲーションを構築します。未認証ユーザーはログイン画面へ、初回起動時はオンボーディングへ、認証済みユーザーはホーム画面へ自動遷移する仕組みを実装します。

## 前提条件
- [ ] T201が完了している (Expoプロジェクトが作成済み)
- [ ] `expo-router` がインストール済み
- [ ] iOS Simulatorでアプリが起動できる

## 実装手順

### Step 1: 必要な追加依存関係のインストール

```bash
cd bananadish-app

# AsyncStorage for onboarding completion tracking
npm install @react-native-async-storage/async-storage
```

### Step 2: オンボーディング画面の実装

`app/onboarding.tsx` を作成:

```typescript
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const ONBOARDING_SCREENS = [
  {
    title: 'BananaDishへようこそ',
    description: '料理写真を一瞬でプロ級に変換します',
  },
  {
    title: '簡単3ステップ',
    description: '撮影 → スタイル選択 → 保存。たったこれだけ。',
  },
  {
    title: 'SNSで目立つ写真を',
    description: 'AIが自動で4パターンの美しい写真を生成します',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SCREENS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    router.replace('/(auth)/login');
  };

  const currentScreen = ONBOARDING_SCREENS[currentIndex];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>スキップ</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>{currentScreen.title}</Text>
        <Text style={styles.description}>{currentScreen.description}</Text>
      </View>

      <View style={styles.pagination}>
        {ONBOARDING_SCREENS.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentIndex && styles.activeDot]}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentIndex === ONBOARDING_SCREENS.length - 1 ? '始める' : '次へ'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  skipText: {
    color: '#666',
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#007AFF',
    width: 24,
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

### Step 3: 認証画面レイアウトの実装

`app/(auth)/_layout.tsx` を作成:

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
```

### Step 4: ログイン画面プレースホルダーの実装

`app/(auth)/login.tsx` を作成:

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ログイン</Text>
      <Text style={styles.subtitle}>BananaDishへようこそ</Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          ログインフォームはT203で実装します
        </Text>
      </View>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/(auth)/signup')}
      >
        <Text style={styles.linkText}>アカウントをお持ちでない方はこちら</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  placeholder: {
    padding: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 20,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#999',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
});
```

### Step 5: サインアップ画面プレースホルダーの実装

`app/(auth)/signup.tsx` を作成:

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function SignupScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>アカウント作成</Text>
      <Text style={styles.subtitle}>無料でBananaDishを始めましょう</Text>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          サインアップフォームはT203で実装します
        </Text>
      </View>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.back()}
      >
        <Text style={styles.linkText}>すでにアカウントをお持ちの方はこちら</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  placeholder: {
    padding: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 20,
  },
  placeholderText: {
    textAlign: 'center',
    color: '#999',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
});
```

### Step 6: Root Layoutの更新（認証フロー制御）

`app/_layout.tsx` を更新:

```typescript
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 仮の認証状態（T203でFirebase Authに置き換える）
function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // T203で実装: Firebase Auth状態チェック
    // 現時点では常に未認証として扱う
    setTimeout(() => {
      setIsAuthenticated(false);
      setIsLoading(false);
    }, 100);
  }, []);

  return { isAuthenticated, isLoading };
}

// オンボーディング完了状態のチェック
function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    const completed = await AsyncStorage.getItem('onboarding_completed');
    setHasCompletedOnboarding(completed === 'true');
    setIsLoading(false);
  };

  return { hasCompletedOnboarding, isLoading };
}

// Protected route logic
function useProtectedRoute(isAuthenticated: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();

  useEffect(() => {
    if (onboardingLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';

    // 初回起動: オンボーディングへ
    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    // 未認証: ログイン画面へ
    if (!isAuthenticated && !inAuthGroup && hasCompletedOnboarding) {
      router.replace('/(auth)/login');
      return;
    }

    // 認証済み: ホーム画面へ
    if (isAuthenticated && !inTabsGroup) {
      router.replace('/(tabs)/home');
      return;
    }
  }, [isAuthenticated, segments, hasCompletedOnboarding, onboardingLoading]);
}

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  useProtectedRoute(isAuthenticated);

  if (isLoading) {
    return null; // または Loading画面
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

### Step 7: Tab Layoutの更新（アイコン改善）

`app/(tabs)/_layout.tsx` を更新:

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '履歴',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

## 完成コード

上記Step 1-7を実行すると、以下のファイル構造が完成:

```
app/
├── _layout.tsx (更新済み - 認証フロー制御)
├── onboarding.tsx (新規)
├── (auth)/
│   ├── _layout.tsx (新規)
│   ├── login.tsx (新規)
│   └── signup.tsx (新規)
└── (tabs)/
    ├── _layout.tsx (更新済み - スタイル改善)
    ├── home.tsx (既存)
    ├── history.tsx (既存)
    └── settings.tsx (既存)
```

## 完了条件（DoD）

- [ ] オンボーディング画面が実装されている (3画面スワイプ可能)
- [ ] ログイン画面プレースホルダーが作成されている
- [ ] サインアップ画面プレースホルダーが作成されている
- [ ] 初回起動時にオンボーディングが表示される
- [ ] オンボーディング完了後、ログイン画面へ遷移する
- [ ] スキップボタンでオンボーディングをスキップできる
- [ ] ログイン⇔サインアップ画面間で遷移できる
- [ ] タブナビゲーションが正しくスタイリングされている
- [ ] 型エラーがない
- [ ] iOS Simulatorで動作確認できる

## 検証手順

```bash
cd bananadish-app

# TypeScriptチェック
npm run type-check
# 期待結果: エラーなし

# アプリ起動
npm run ios
```

**手動テスト手順**:

1. **初回起動フロー**:
   - アプリを起動
   - オンボーディング1画面目が表示される → ✓
   - 「次へ」をタップして3画面目まで進む → ✓
   - 「始める」をタップ → ログイン画面へ遷移 → ✓

2. **オンボーディングスキップ**:
   - アプリを削除して再インストール
   - AsyncStorageをクリア: `AsyncStorage.clear()`
   - オンボーディング画面で「スキップ」をタップ → ✓
   - ログイン画面へ遷移 → ✓

3. **画面遷移**:
   - ログイン画面から「アカウントをお持ちでない方はこちら」をタップ → ✓
   - サインアップ画面が表示される → ✓
   - 「すでにアカウントをお持ちの方はこちら」をタップ → ✓
   - ログイン画面へ戻る → ✓

4. **AsyncStorage確認**:
   ```typescript
   // Expo DevツールのConsoleで実行
   import AsyncStorage from '@react-native-async-storage/async-storage';
   AsyncStorage.getItem('onboarding_completed').then(console.log);
   // 期待結果: "true"
   ```

## トラブルシューティング

### 問題: オンボーディングが毎回表示される

**解決策**:
```typescript
// AsyncStorageのリセット（開発中のみ）
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('onboarding_completed');
```

### 問題: 画面遷移がループする

**症状**: オンボーディング → ログイン → オンボーディング と無限ループ

**解決策**:
- `app/_layout.tsx` の `useProtectedRoute` ロジックを確認
- `useEffect` の依存配列が正しいか確認
- Expo DevツールでRouterの状態をログ出力

### 問題: TabアイコンのIoniconsが表示されない

**解決策**:
```bash
# @expo/vector-iconsの再インストール
npm install @expo/vector-icons

# Expo開発サーバーを再起動
npm start -- --clear
```

### 問題: TypeScript型エラー "Property 'name' does not exist"

**解決策**:
```bash
# Expo Routerの型定義を再生成
npx expo customize tsconfig.json

# 開発サーバー再起動
npm start -- --clear
```

## Deliverables

- 3画面のオンボーディングフロー (スワイプ可能)
- ログイン画面プレースホルダー
- サインアップ画面プレースホルダー
- 認証状態に基づく自動ルーティングロジック
- AsyncStorage連携によるオンボーディング完了状態の永続化

## Notes

- 認証ロジックは**仮実装**。T203でFirebase Authに置き換える
- オンボーディングUIは簡易版。必要に応じてSwiper等のライブラリで改善可能
- `useAuth` フックはT203で実装するAuthContext を使用するように更新する
- ログイン/サインアップ画面の実際のフォームはT203で実装
- **Type-safe routing**: Expo Routerにより、ルート名が型チェックされる

## 関連ドキュメント

- [技術設計書 - Navigation Implementation](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#navigation-implementation)
- [実装計画書 - T202](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t202-navigation--routing-implementation)
