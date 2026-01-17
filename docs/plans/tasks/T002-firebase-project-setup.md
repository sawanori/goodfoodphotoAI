# T002: Firebase Project Setup

## Task Overview
Firebaseプロジェクトを作成し、GCPプロジェクトとリンクする。認証プロバイダー (Email/Password, Google, Apple Sign-In) を設定し、Firestoreデータベースを初期化する。セキュリティルールをデプロイし、Analytics/Crashlyticsを有効化する。

## Dependencies
- **T001: GCP Project Setup** (完了必須)
  - GCPプロジェクト `bananadish-prod` が存在すること

## Target Files

新規作成:
- `firestore.rules` (Firestoreセキュリティルール)
- `firestore.indexes.json` (Firestoreインデックス定義)
- `docs/setup/firebase-config.md` (任意: Firebase設定情報の記録)

## Implementation Steps

### Step 1: Firebaseプロジェクト作成とGCPリンク

1. **Firebase Consoleにアクセス**
   ```bash
   open https://console.firebase.google.com/
   ```

2. **プロジェクトを追加**
   - 「プロジェクトを追加」をクリック
   - 既存のGCPプロジェクトをインポート: `bananadish-prod` を選択
   - 「続行」

3. **Google Analyticsの設定**
   - 「このプロジェクトでGoogle Analyticsを有効にする」: **有効** (チェック)
   - Analyticsアカウント: 既存のアカウントを選択、または新規作成
   - 「Firebaseを追加」をクリック

4. **プロジェクトID確認**
   - Firebase Console → プロジェクト設定 → 全般
   - プロジェクトID が `bananadish-prod` であることを確認

### Step 2: Firebase Authentication設定

1. **Authentication有効化**
   - 左メニュー「構築」→「Authentication」
   - 「始める」をクリック

2. **Email/Passwordプロバイダーを有効化**
   - 「Sign-in method」タブ
   - 「メール/パスワード」をクリック
   - 「有効にする」をオン
   - 「保存」

3. **Google Sign-Inを有効化**
   - 「Google」をクリック
   - 「有効にする」をオン
   - プロジェクトのサポートメール: 自分のメールアドレスを入力
   - 「保存」

4. **Apple Sign-Inを有効化** (後でApple Developer設定後に再設定)
   - 「Apple」をクリック
   - 「有効にする」をオン
   - **注意**: Service ID, Team ID, Key IDは後でPhase 3で設定
   - 今は有効化のみで「保存」

5. **テストユーザー作成**
   ```bash
   # Firebase CLIでテストユーザー作成 (オプション)
   # または Firebase Console → Authentication → Users → ユーザーを追加
   # Email: test@bananadish.com
   # Password: testpassword123
   ```

### Step 3: Firestore Database作成

1. **Firestoreを有効化**
   - 左メニュー「構築」→「Firestore Database」
   - 「データベースを作成」をクリック

2. **セキュリティルールの選択**
   - **本番モード**を選択 (セキュリティルールを後でデプロイするため)
   - 「次へ」

3. **ロケーション選択**
   - ロケーション: `asia-northeast1 (Tokyo)` を選択
   - 「有効にする」

4. **データベース作成完了を確認**
   - Firestoreコンソールで空のデータベースが表示される

### Step 4: Firestoreセキュリティルールのデプロイ

1. **プロジェクトルートで`firestore.rules`ファイル作成**

```bash
# プロジェクトルートに移動
cd /home/noritakasawada/project/20260117
```

`firestore.rules` の内容:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ユーザードキュメント: 本人のみ読み書き可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // その他のコレクション: デフォルト拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

2. **`firestore.indexes.json`ファイル作成**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

3. **Firebase CLIでデプロイ**

```bash
# Firebase CLIインストール確認
firebase --version

# Firebaseプロジェクトにログイン
firebase login

# プロジェクトを初期化 (既に初期化済みの場合はスキップ)
firebase init firestore

# デプロイ
firebase deploy --only firestore:rules
```

**期待される出力**:
```
✔  Deploy complete!
```

### Step 5: Firebase Admin SDK設定

1. **サービスアカウントキーの生成**
   - Firebase Console → プロジェクト設定 → サービスアカウント
   - 「新しい秘密鍵の生成」をクリック
   - 「キーを生成」
   - JSONファイルがダウンロードされる (例: `bananadish-prod-firebase-adminsdk-xxxxx.json`)

2. **キーファイルを一時的に安全な場所に保存**
   ```bash
   # ダウンロードフォルダから移動 (例)
   mv ~/Downloads/bananadish-prod-firebase-adminsdk-*.json ~/bananadish-firebase-key.json

   # 権限を厳格化
   chmod 600 ~/bananadish-firebase-key.json
   ```

   **重要**: このファイルは**絶対にGitにコミットしない**
   - T003でSecret Managerに格納する
   - ローカルでの一時保管のみ

### Step 6: Firebase Analytics & Crashlytics有効化

1. **Analyticsの確認**
   - 左メニュー「Analytics」→「ダッシュボード」
   - 既にStep 1で有効化済みのため、データが流れることを確認

2. **Crashlytics有効化**
   - 左メニュー「リリースとモニタリング」→「Crashlytics」
   - 「始める」をクリック
   - 「有効にする」
   - **注意**: 実際の統合はPhase 2 (React Nativeアプリ) で実施

### Step 7: Firebase設定情報の記録 (任意)

`docs/setup/firebase-config.md` を作成し、以下を記録:

```markdown
# Firebase Configuration

## Project Info
- Project ID: bananadish-prod
- Project Number: [Firebase Consoleから取得]
- Region: asia-northeast1

## Authentication
- Enabled Providers:
  - Email/Password: ✓
  - Google Sign-In: ✓
  - Apple Sign-In: ✓ (設定はPhase 3で完了)

## Firestore
- Location: asia-northeast1 (Tokyo)
- Mode: Production
- Security Rules: Deployed

## Admin SDK
- Service Account Key: ~/bananadish-firebase-key.json (ローカル一時保管)
- 次のステップ: T003でSecret Managerに格納

## Web API Key (クライアント用)
- API Key: [Firebase Console → プロジェクト設定 → 全般 → ウェブAPIキー]
```

## Completion Criteria (DoD)

- [ ] Firebaseプロジェクト `bananadish-prod` がGCPプロジェクトとリンクされている
- [ ] Firebase Authenticationが有効化されている
- [ ] 以下の認証プロバイダーが有効:
  - [ ] Email/Password
  - [ ] Google Sign-In
  - [ ] Apple Sign-In (有効化のみ、詳細設定はPhase 3)
- [ ] Firestore Database (本番モード) が `asia-northeast1` に作成されている
- [ ] Firestoreセキュリティルールがデプロイされている
- [ ] Firebase Admin SDK秘密鍵が生成され、安全に保管されている
- [ ] Firebase Analyticsが有効化されている
- [ ] Firebase Crashlyticsが有効化されている

## Verification Commands

```bash
# Firebase CLIでプロジェクト確認
firebase projects:list | grep bananadish-prod

# Firestoreルールのデプロイ確認
firebase deploy --only firestore:rules --dry-run

# gcloud CLIでFirestoreデータベース確認
gcloud firestore databases list --project=bananadish-prod

# サービスアカウントキーファイルの存在確認
ls -lh ~/bananadish-firebase-key.json
# 期待: -rw------- (600権限) で存在
```

**Firebase Consoleでの確認**:
1. Authentication → Sign-in method: 3つのプロバイダーが有効
2. Firestore Database: データベースが作成されている
3. プロジェクト設定 → サービスアカウント: 秘密鍵が生成されている

## Troubleshooting

### 問題: Firestoreのロケーションが選択できない
**原因**: GCPプロジェクトで既にApp Engineが有効化されている場合、ロケーションが固定される
**解決策**:
```bash
# App Engineのリージョン確認
gcloud app describe --project=bananadish-prod
# asia-northeast1以外の場合、Firestoreも同じリージョンになる
```

### 問題: Firebase CLIのデプロイでエラー
**解決策**:
```bash
# プロジェクトを明示的に指定
firebase use bananadish-prod

# 再度デプロイ
firebase deploy --only firestore:rules
```

### 問題: サービスアカウントキーのダウンロードができない
**解決策**:
- ブラウザのポップアップブロックを無効化
- または gcloud CLIで生成:
  ```bash
  gcloud iam service-accounts keys create ~/bananadish-firebase-key.json \
    --iam-account=firebase-adminsdk@bananadish-prod.iam.gserviceaccount.com
  ```

## Deliverables

- Firebaseプロジェクト: `bananadish-prod` (GCPとリンク済み)
- Firestore Database: `asia-northeast1` リージョン
- セキュリティルールファイル: `firestore.rules`
- Firebase Admin SDK秘密鍵: `~/bananadish-firebase-key.json` (ローカル一時保管)
- 認証プロバイダー: Email/Password, Google, Apple (有効化済み)

## Notes

- **セキュリティ重要**: Firebase Admin SDK秘密鍵は絶対にGitにコミットしない
- `.gitignore` に以下を追加すること:
  ```
  *firebase-key.json
  *adminsdk*.json
  ```
- T003でこの秘密鍵をSecret Managerに格納し、ローカルファイルは削除
- Apple Sign-Inの詳細設定 (Service ID等) はPhase 3で実施
- テストユーザーでの認証テストはT203 (Authentication UI) で実施

## Estimated Time
45-60分
