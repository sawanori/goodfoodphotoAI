# T203: Authentication UI & Firebase Integration

## 基本情報
- **タスクID**: T203
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**:
  - T202 (Navigation & Routing)
  - T002 (Firebase Project Setup)
- **成果物**:
  - `services/auth/firebase.ts`
  - `contexts/AuthContext.tsx`
  - `hooks/useAuth.ts`
  - `app/(auth)/login.tsx` (更新)
  - `app/(auth)/signup.tsx` (更新)
  - `app/_layout.tsx` (認証ロジック更新)
  - Firebase設定ファイル (`google-services.json`, `GoogleService-Info.plist`)
- **推定時間**: 3-4時間

## 概要
Firebase Authentication SDKを統合し、Email/Password、Google Sign-In、Apple Sign-Inの3つの認証方法を実装します。AuthContextによるグローバル認証状態管理を構築し、ログイン/サインアップ画面のUIを完成させます。

**注意**: UIデザインについて、必要に応じて**frontend-design skill**を使用してプロフェッショナルなUIコンポーネントを生成することができます。

## 前提条件
- [ ] T202が完了している (ナビゲーション実装済み)
- [ ] T002が完了している (Firebase Project設定済み)
- [ ] Firebase Console で以下が設定済み:
  - [ ] Email/Passwordプロバイダー有効化
  - [ ] Google Sign-In設定 (OAuth 2.0 Client ID取得済み)
  - [ ] Apple Sign-In設定 (Service ID, Team ID, Key ID設定済み)

## 実装手順

### Step 1: Firebase iOS設定ファイルのダウンロード

```bash
# Firebase Console (https://console.firebase.google.com/)
# 1. プロジェクト設定 → 全般
# 2. iOS アプリを追加
#    - Apple バンドルID: com.bananadish.app
#    - アプリのニックネーム: BananaDish iOS
# 3. GoogleService-Info.plist をダウンロード
# 4. bananadish-app/ ディレクトリに配置
```

**ファイル配置**:
```bash
cd bananadish-app
# GoogleService-Info.plist をプロジェクトルートに配置
```

### Step 2: Firebase SDKのインストールと設定

```bash
cd bananadish-app

# Firebase SDK (React Native用)
npx expo install @react-native-firebase/app @react-native-firebase/auth

# Google Sign-In
npx expo install @react-native-google-signin/google-signin

# Apple Authentication
npx expo install expo-apple-authentication
```

**app.json の更新**:

```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      [
        "@react-native-firebase/auth",
        {
          "googleServicesFile": "./GoogleService-Info.plist"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_CLIENT_ID"
        }
      ],
      "expo-apple-authentication"
    ]
  }
}
```

### Step 3: Firebase Auth Service の実装

`services/auth/firebase.ts` を作成:

```typescript
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

// Google Sign-In設定
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Firebase Consoleから取得
});

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * 現在のユーザーを取得
 */
export const getCurrentUser = (): User | null => {
  const firebaseUser = auth().currentUser;
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
};

/**
 * Email/Passwordでサインアップ
 */
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  const userCredential = await auth().createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
};

/**
 * Email/Passwordでサインイン
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  const user = userCredential.user;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
};

/**
 * Googleでサインイン
 */
export const signInWithGoogle = async (): Promise<User> => {
  // Google Sign-Inフロー
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { idToken } = await GoogleSignin.signIn();

  // Firebase認証
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(googleCredential);
  const user = userCredential.user;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
};

/**
 * Appleでサインイン
 */
export const signInWithApple = async (): Promise<User> => {
  // Apple Sign-Inフロー
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  // Firebase認証
  const { identityToken, fullName } = credential;
  if (!identityToken) {
    throw new Error('Apple Sign-In failed: No identity token');
  }

  const appleCredential = auth.AppleAuthProvider.credential(identityToken);
  const userCredential = await auth().signInWithCredential(appleCredential);
  const user = userCredential.user;

  // 初回サインインの場合、表示名を設定
  if (fullName?.givenName && !user.displayName) {
    await user.updateProfile({
      displayName: `${fullName.givenName} ${fullName.familyName || ''}`.trim(),
    });
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
};

/**
 * サインアウト
 */
export const signOut = async (): Promise<void> => {
  await auth().signOut();

  // Google Sign-Outも実行
  if (await GoogleSignin.isSignedIn()) {
    await GoogleSignin.signOut();
  }
};

/**
 * ID Tokenを取得 (API呼び出し用)
 */
export const getIdToken = async (forceRefresh: boolean = false): Promise<string> => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user');
  }

  return await currentUser.getIdToken(forceRefresh);
};

/**
 * 認証状態変更リスナー
 */
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return auth().onAuthStateChanged(firebaseUser => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });
    } else {
      callback(null);
    }
  });
};
```

### Step 4: AuthContext の実装

`contexts/AuthContext.tsx` を作成:

```typescript
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  getCurrentUser,
  signUpWithEmail as firebaseSignUp,
  signInWithEmail as firebaseSignIn,
  signInWithGoogle as firebaseGoogleSignIn,
  signInWithApple as firebaseAppleSignIn,
  signOut as firebaseSignOut,
  getIdToken as firebaseGetIdToken,
  onAuthStateChanged,
} from '@/services/auth/firebase';

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(async firebaseUser => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // ID Tokenを取得
        try {
          const token = await firebaseGetIdToken();
          setIdToken(token);
        } catch (error) {
          console.error('Failed to get ID token:', error);
        }
      } else {
        setIdToken(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string) => {
    const newUser = await firebaseSignUp(email, password);
    setUser(newUser);
    const token = await firebaseGetIdToken();
    setIdToken(token);
  };

  const signIn = async (email: string, password: string) => {
    const authenticatedUser = await firebaseSignIn(email, password);
    setUser(authenticatedUser);
    const token = await firebaseGetIdToken();
    setIdToken(token);
  };

  const signInWithGoogle = async () => {
    const authenticatedUser = await firebaseGoogleSignIn();
    setUser(authenticatedUser);
    const token = await firebaseGetIdToken();
    setIdToken(token);
  };

  const signInWithApple = async () => {
    const authenticatedUser = await firebaseAppleSignIn();
    setUser(authenticatedUser);
    const token = await firebaseGetIdToken();
    setIdToken(token);
  };

  const signOut = async () => {
    await firebaseSignOut();
    setUser(null);
    setIdToken(null);
  };

  const refreshIdToken = async (): Promise<string> => {
    const token = await firebaseGetIdToken(true);
    setIdToken(token);
    return token;
  };

  const value: AuthContextType = {
    user,
    idToken,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### Step 5: useAuth カスタムフックの実装

`hooks/useAuth.ts` を作成:

```typescript
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
```

### Step 6: Root Layout の更新（AuthProvider統合）

`app/_layout.tsx` を更新:

```typescript
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// オンボーディング完了チェック
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
function RootLayoutNavigator() {
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { hasCompletedOnboarding, isLoading: onboardingLoading } = useOnboarding();

  useEffect(() => {
    if (authLoading || onboardingLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';

    // 初回起動: オンボーディングへ
    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    // 未認証: ログイン画面へ
    if (!user && !inAuthGroup && hasCompletedOnboarding) {
      router.replace('/(auth)/login');
      return;
    }

    // 認証済み: ホーム画面へ
    if (user && !inTabsGroup) {
      router.replace('/(tabs)/home');
      return;
    }
  }, [user, authLoading, segments, hasCompletedOnboarding, onboardingLoading]);

  if (authLoading || onboardingLoading) {
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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNavigator />
    </AuthProvider>
  );
}
```

### Step 7: ログイン画面の実装

`app/(auth)/login.tsx` を更新:

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // 成功時の遷移はapp/_layout.tsxで自動処理
    } catch (error: any) {
      Alert.alert('ログイン失敗', error.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('ログイン失敗', 'Googleログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('ログイン失敗', 'Apple Sign-Inに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ログイン</Text>
      <Text style={styles.subtitle}>BananaDishへようこそ</Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="パスワード"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handleEmailLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>ログイン</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>または</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        <Ionicons name="logo-google" size={20} color="#000" />
        <Text style={styles.socialButtonText}>Googleでログイン</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={handleAppleLogin}
        />
      )}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push('/(auth)/signup')}
        disabled={loading}
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 12,
  },
  linkButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
});
```

### Step 8: サインアップ画面の実装

`app/(auth)/signup.tsx` を更新:

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // バリデーション
    if (!email || !password || !confirmPassword) {
      Alert.alert('エラー', '全ての項目を入力してください');
      return;
    }

    if (password.length < 8) {
      Alert.alert('エラー', 'パスワードは8文字以上で設定してください');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('エラー', 'パスワードが一致しません');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      // 成功時の遷移はapp/_layout.tsxで自動処理
    } catch (error: any) {
      let message = 'アカウント作成に失敗しました';
      if (error.code === 'auth/email-already-in-use') {
        message = 'このメールアドレスは既に使用されています';
      } else if (error.code === 'auth/invalid-email') {
        message = 'メールアドレスの形式が正しくありません';
      }
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>アカウント作成</Text>
      <Text style={styles.subtitle}>無料でBananaDishを始めましょう</Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="パスワード (8文字以上)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="パスワード (確認)"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>アカウントを作成</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.back()}
        disabled={loading}
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
});
```

## 完了条件（DoD）

- [ ] Firebase SDK が正しく設定されている
- [ ] `GoogleService-Info.plist` が配置されている
- [ ] Email/Password サインアップが動作する
- [ ] Email/Password ログインが動作する
- [ ] Google Sign-Inが動作する (実機テスト)
- [ ] Apple Sign-Inが動作する (実機テスト)
- [ ] AuthContextでグローバル認証状態が管理されている
- [ ] サインアウトが正しく機能する
- [ ] Firebase Consoleでユーザーが確認できる
- [ ] エラーメッセージが日本語で表示される
- [ ] ID Tokenが取得できる (API呼び出し用)

## 検証手順

```bash
cd bananadish-app

# TypeScriptチェック
npm run type-check

# アプリ起動 (シミュレーター)
npm run ios
```

**手動テスト手順**:

1. **Email/Passwordサインアップ**:
   - サインアップ画面で新規メールアドレスとパスワードを入力
   - 「アカウントを作成」をタップ
   - Firebase Consoleでユーザーが作成されていることを確認
   - 自動的にホーム画面へ遷移することを確認

2. **Email/Passwordログイン**:
   - サインアウト
   - ログイン画面で登録したメールアドレスとパスワードを入力
   - 「ログイン」をタップ
   - ホーム画面へ遷移することを確認

3. **Google Sign-In** (実機のみ):
   - 「Googleでログイン」をタップ
   - Googleアカウント選択画面が表示される
   - アカウント選択
   - ホーム画面へ遷移することを確認
   - Firebase Consoleでユーザーが確認できる

4. **Apple Sign-In** (実機のみ):
   - 「Sign in with Apple」ボタンをタップ
   - Apple ID認証画面が表示される
   - Face ID/Touch IDで認証
   - ホーム画面へ遷移することを確認

5. **ID Token取得確認**:
   ```typescript
   // Expo DevツールのConsoleで実行
   import { useAuth } from '@/hooks/useAuth';
   const { idToken } = useAuth();
   console.log('ID Token:', idToken);
   // JWT形式のトークンが表示される
   ```

## トラブルシューティング

### 問題: Google Sign-Inでエラー

**症状**: "DEVELOPER_ERROR" または "A non-recoverable sign in failure occurred"

**解決策**:
```bash
# 1. Firebase Consoleで正しいSHA-1フィンガープリントを登録
# 2. OAuth 2.0 Web Client IDをGoogleSignin.configureに設定
# 3. app.jsonのiosUrlSchemeを確認

# SHA-1取得方法 (iOS)
cd ios
openssl x509 -in <証明書ファイル> -fingerprint -sha1
```

### 問題: Apple Sign-Inが表示されない

**解決策**:
- iOS実機でのみ動作 (シミュレーターは不可)
- Apple Developer AccountでSign in with Appleが有効化されているか確認
- Bundle IDが正しく設定されているか確認

### 問題: Firebase接続エラー

**症状**: "Firebase App named '[DEFAULT]' already exists"

**解決策**:
```bash
# アプリを完全に削除して再インストール
# メトロバンドラーのキャッシュクリア
npm start -- --clear
```

### 問題: TypeScriptエラー "Cannot find module '@/contexts/AuthContext'"

**解決策**:
```bash
# tsconfig.jsonのpathsが正しく設定されているか確認
# VSCodeを再起動
```

## Deliverables

- Firebase Auth統合完了
- 3つの認証方法 (Email/Password, Google, Apple)
- AuthContextによるグローバル状態管理
- ログイン/サインアップ画面UI
- ID Token取得機能 (API呼び出し用)

## Notes

- **Google Sign-In**: Web Client IDはFirebase Console → 認証 → Sign-in method → Google から取得
- **Apple Sign-In**: iOS実機でのみテスト可能
- **セッション永続化**: Firebase SDKが自動的にセッションを保持
- **ID Token**: T205でBackend API呼び出し時に使用
- **frontend-design skill**: より洗練されたUIが必要な場合は、このスキルを使用してコンポーネントを生成可能

## 関連ドキュメント

- [技術設計書 - Authentication Design](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md#authentication--authorization-design)
- [実装計画書 - T203](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t203-authentication-ui--firebase-integration)
- [Firebase Console](https://console.firebase.google.com/)
