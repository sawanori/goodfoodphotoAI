# T201: React Native Project Setup with Expo

## 基本情報
- **タスクID**: T201
- **フェーズ**: Phase 2: Frontend Development
- **依存タスク**: T003 (Development Environment Configuration)
- **成果物**:
  - `bananadish-app/` ディレクトリ
  - Expo プロジェクト設定ファイル (`app.json`, `package.json`)
  - TypeScript設定ファイル (`tsconfig.json`)
  - ESLint/Prettier設定
  - 基本フォルダ構造
- **推定時間**: 1-2時間

## 概要
React Native (Expo) プロジェクトを初期化し、BananaDish iOS アプリケーションの基盤を構築します。必要な依存関係をインストールし、iOS向けの設定を行い、開発環境を整えます。

## 前提条件
- [ ] Node.js 20 LTS以上がインストール済み
- [ ] npm または yarn がインストール済み
- [ ] Expo CLI がグローバルインストール済み (`npm install -g expo-cli`)
- [ ] Xcode がインストール済み (macOS)
- [ ] iOS Simulator が利用可能

## 実装手順

### Step 1: プロジェクトディレクトリの作成

```bash
# プロジェクトルートで実行
cd /home/noritakasawada/project/20260117

# Expo プロジェクト作成
npx create-expo-app bananadish-app --template blank-typescript

# プロジェクトディレクトリに移動
cd bananadish-app
```

### Step 2: 必要な依存関係のインストール

```bash
# Core dependencies
npm install expo-image-picker expo-media-library expo-router expo-file-system

# Firebase dependencies
npm install @react-native-firebase/app @react-native-firebase/auth

# IAP dependency
npm install react-native-iap

# UI/Utility dependencies
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-safe-area-context react-native-screens

# Development dependencies
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install --save-dev eslint-config-expo prettier eslint-plugin-prettier
```

### Step 3: app.json の設定

`app.json` を以下の内容で設定:

```json
{
  "expo": {
    "name": "BananaDish",
    "slug": "bananadish-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.bananadish.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "BananaDishは料理写真を撮影するためにカメラへのアクセスが必要です。",
        "NSPhotoLibraryUsageDescription": "BananaDishは写真を選択して加工するためにフォトライブラリへのアクセスが必要です。",
        "NSPhotoLibraryAddUsageDescription": "BananaDishは加工した写真を保存するためにフォトライブラリへのアクセスが必要です。"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-image-picker",
        {
          "photosPermission": "BananaDishは写真を選択して加工するためにフォトライブラリへのアクセスが必要です。",
          "cameraPermission": "BananaDishは料理写真を撮影するためにカメラへのアクセスが必要です。"
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "BananaDishは加工した写真を保存するためにフォトライブラリへのアクセスが必要です。",
          "savePhotosPermission": "BananaDishは加工した写真をカメラロールに保存するために必要です。"
        }
      ]
    ],
    "scheme": "bananadish",
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

### Step 4: フォルダ構造の作成

```bash
# プロジェクトルートで実行 (bananadish-app/ ディレクトリ内)

# Expo Router用のappディレクトリ構造
mkdir -p app/\(auth\)
mkdir -p app/\(tabs\)

# その他の主要ディレクトリ
mkdir -p components
mkdir -p services/api
mkdir -p services/auth
mkdir -p services/storage
mkdir -p services/iap
mkdir -p hooks
mkdir -p contexts
mkdir -p types
mkdir -p constants
mkdir -p assets/images
```

### Step 5: TypeScript設定

`tsconfig.json` を以下の内容で作成/更新:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-native",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["./components/*"],
      "@services/*": ["./services/*"],
      "@hooks/*": ["./hooks/*"],
      "@contexts/*": ["./contexts/*"],
      "@types/*": ["./types/*"],
      "@constants/*": ["./constants/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

### Step 6: ESLint + Prettier設定

`.eslintrc.js` を作成:

```javascript
module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
```

`.prettierrc` を作成:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "avoid"
}
```

### Step 7: 基本のApp Layout作成

`app/_layout.tsx` を作成:

```typescript
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

`app/(tabs)/_layout.tsx` を作成:

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
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
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Step 8: プレースホルダー画面の作成

`app/(tabs)/home.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>ホーム画面</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
  },
});
```

`app/(tabs)/history.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>履歴画面</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
  },
});
```

`app/(tabs)/settings.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>設定画面</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
  },
});
```

### Step 9: package.jsonスクリプトの追加

`package.json` に以下のスクリプトを追加:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit"
  }
}
```

## 完成コード

上記のStep 1-9を実行すると、以下の構造が完成します:

```
bananadish-app/
├── app/
│   ├── (auth)/
│   │   └── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── history.tsx
│   │   └── settings.tsx
│   └── _layout.tsx
├── components/
├── services/
│   ├── api/
│   ├── auth/
│   ├── storage/
│   └── iap/
├── hooks/
├── contexts/
├── types/
├── constants/
├── assets/
├── app.json
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
└── package.json
```

## 完了条件（DoD）

- [ ] Expoプロジェクトが作成されている
- [ ] 全ての必要な依存関係がインストールされている
- [ ] `app.json` がiOS向けに正しく設定されている
- [ ] フォルダ構造が技術設計書通りに作成されている
- [ ] TypeScript設定が完了している
- [ ] ESLint + Prettier が設定されている
- [ ] 基本的なルーティング構造が実装されている
- [ ] 3つのタブ画面 (home, history, settings) が表示される
- [ ] iOS Simulatorでアプリが起動する
- [ ] TypeScriptコンパイルエラーがない
- [ ] ホットリロードが動作する

## 検証手順

```bash
# プロジェクトディレクトリで実行
cd bananadish-app

# TypeScriptの型チェック
npm run type-check
# 期待結果: エラーなし

# Lintチェック
npm run lint
# 期待結果: エラーなし (警告は許容)

# 開発サーバー起動
npm start
# 期待結果: Expo DevツールがWebブラウザで開く

# iOSシミュレーターで起動
npm run ios
# 期待結果: シミュレーターが起動し、3つのタブが表示される

# 依存関係の確認
npm list --depth=0
# 期待結果: expo-image-picker, expo-media-library, expo-router,
#          @react-native-firebase/app, react-native-iap などが含まれている
```

## トラブルシューティング

### 問題: Expoプロジェクト作成時にエラー

**症状**: `npx create-expo-app` がエラーで失敗する

**解決策**:
```bash
# Node.jsのバージョン確認
node --version  # v20以上であることを確認

# npmキャッシュクリア
npm cache clean --force

# 再試行
npx create-expo-app@latest bananadish-app --template blank-typescript
```

### 問題: iOS Simulatorが起動しない

**解決策**:
```bash
# Xcode Command Line Toolsの確認
xcode-select -p
# 出力がない場合: sudo xcode-select --install

# Simulatorを手動で起動
open -a Simulator

# Expo CLIから再起動
npm run ios
```

### 問題: TypeScriptエラーが多数表示される

**解決策**:
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScript定義ファイルの再生成
npx expo customize tsconfig.json
```

### 問題: Firebaseライブラリのインストールエラー

**症状**: `@react-native-firebase` のインストールでエラー

**解決策**:
```bash
# CocoaPodsの更新 (macOS)
cd ios
pod install
cd ..

# または、Expo managed workflowでは設定ファイルで対応
# app.jsonのpluginsセクションで設定を追加
```

## Deliverables

- Expo TypeScriptプロジェクト: `bananadish-app/`
- アプリBundle ID: `com.bananadish.app`
- iOS最低バージョン: 14.0
- 基本的な3タブナビゲーション (Home, History, Settings)

## Notes

- このタスクは**Phase 2の基盤**となる最重要タスク
- Expo Router (file-based routing) を使用することで、React Navigationの複雑な設定を回避
- TypeScript strictモードを有効化し、型安全性を確保
- 後続タスク (T202-T207) で各画面を実装していく
- Firebase設定はT203で行うため、ここでは依存関係のインストールのみ
- **frontend-design skill**: UIデザインが必要な場合はT203以降で使用

## 関連ドキュメント

- [技術設計書 - Frontend Design](/home/noritakasawada/project/20260117/docs/design/bananadish-design.md)
- [実装計画書 - Phase 2](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#phase-2-frontend-development)
