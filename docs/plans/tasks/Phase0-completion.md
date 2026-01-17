# Phase 0 Completion: Environment Setup Verification

## Task Overview
Phase 0 (環境構築) で実施した全てのタスク (T001-T003) の完了を検証する。GCP、Firebase、Secret Manager、ローカル開発環境の全てが正しく設定され、Phase 1 (バックエンド開発) に進む準備が整っていることを確認する。

## Dependencies
- **T001: GCP Project Setup** (完了必須)
- **T002: Firebase Project Setup** (完了必須)
- **T003: Development Environment** (完了必須)

## Target Files

新規作成:
- `docs/verification/phase0-completion-report.md` (検証レポート)

## Verification Procedure

### Section 1: GCP Project Verification (T001)

#### 1.1 プロジェクト存在確認
```bash
gcloud projects describe bananadish-prod
```

**期待される出力**:
- projectId: `bananadish-prod`
- lifecycleState: `ACTIVE`

#### 1.2 必要なAPIの有効化確認
```bash
gcloud services list --enabled --project=bananadish-prod --filter="name:run.googleapis.com OR name:secretmanager.googleapis.com OR name:cloudbuild.googleapis.com OR name:logging.googleapis.com"
```

**期待される出力**: 以下の4つのAPIが全て有効
- run.googleapis.com (Cloud Run API)
- secretmanager.googleapis.com (Secret Manager API)
- cloudbuild.googleapis.com (Cloud Build API)
- logging.googleapis.com (Cloud Logging API)

#### 1.3 サービスアカウント確認
```bash
gcloud iam service-accounts list --project=bananadish-prod --filter="email:bananadish-backend@bananadish-prod.iam.gserviceaccount.com"
```

**期待される出力**: サービスアカウントが存在

#### 1.4 IAMロール確認
```bash
gcloud projects get-iam-policy bananadish-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

**期待される出力**: 以下の3つのロールが付与されている
- roles/secretmanager.secretAccessor
- roles/datastore.user
- roles/logging.logWriter

#### 1.5 予算アラート確認
```bash
# GCPコンソールで確認 (CLIでは取得困難)
open https://console.cloud.google.com/billing/budgets?project=bananadish-prod
```

**期待される結果**:
- 予算名: `BananaDish Monthly Budget`
- 金額: ¥50,000/月
- アラート: 50%, 90%, 100%

### Section 2: Firebase Project Verification (T002)

#### 2.1 Firebase プロジェクト確認
```bash
firebase projects:list | grep bananadish-prod
```

**期待される出力**: bananadish-prod がリストに表示される

#### 2.2 Authentication プロバイダー確認
```bash
# Firebase Consoleで確認
open https://console.firebase.google.com/project/bananadish-prod/authentication/providers
```

**期待される結果**:
- Email/Password: 有効
- Google: 有効
- Apple: 有効

#### 2.3 Firestore データベース確認
```bash
gcloud firestore databases list --project=bananadish-prod
```

**期待される出力**:
- name: `(default)`
- locationId: `asia-northeast1`
- type: `FIRESTORE_NATIVE`

#### 2.4 Firestore セキュリティルール確認
```bash
# ルールファイルの存在確認
cat firestore.rules

# デプロイ確認 (dry-run)
firebase deploy --only firestore:rules --dry-run --project=bananadish-prod
```

**期待される出力**: エラーなく dry-run が成功

#### 2.5 Firebase Analytics 確認
```bash
# Firebase Consoleで確認
open https://console.firebase.google.com/project/bananadish-prod/analytics
```

**期待される結果**: Analyticsダッシュボードが有効化されている

### Section 3: Secret Manager Verification (T003)

#### 3.1 シークレット存在確認
```bash
gcloud secrets list --project=bananadish-prod
```

**期待される出力**: 以下の2つのシークレットが存在
- GEMINI_API_KEY
- FIREBASE_SERVICE_ACCOUNT

#### 3.2 シークレットアクセステスト
```bash
# Gemini APIキーの取得テスト
gcloud secrets versions access latest --secret="GEMINI_API_KEY" --project=bananadish-prod | head -c 20
# 期待: AIzaSy... (最初の20文字)

# Firebase Service Accountの取得テスト
gcloud secrets versions access latest --secret="FIREBASE_SERVICE_ACCOUNT" --project=bananadish-prod | jq '.type'
# 期待: "service_account"
```

#### 3.3 Gemini API接続テスト
```bash
GEMINI_KEY=$(gcloud secrets versions access latest --secret="GEMINI_API_KEY" --project=bananadish-prod)

curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_KEY" | jq '.models[0].name'
# 期待: "models/gemini-..." (モデル名が返される)
```

### Section 4: Local Development Environment Verification (T003)

#### 4.1 開発ツール確認
```bash
# Node.js
node --version
# 期待: v20.x.x 以上

# npm
npm --version
# 期待: v10.x.x 以上

# gcloud CLI
gcloud --version | head -1
# 期待: Google Cloud SDK xxx.x.x

# Firebase CLI
firebase --version
# 期待: 13.x.x 以上

# Xcode
xcode-select -p
# 期待: /Applications/Xcode.app/Contents/Developer

# Git
git --version
# 期待: git version 2.x.x
```

#### 4.2 Git リポジトリ確認
```bash
# Git初期化確認
git status

# .gitignore確認
git check-ignore .env
# 期待: .env (除外されている)

git check-ignore node_modules
# 期待: node_modules (除外されている)

# コミット履歴確認
git log --oneline
# 期待: Initial commit が存在
```

#### 4.3 環境変数テンプレート確認
```bash
# .env.template の存在確認
cat .env.template | grep GCP_PROJECT_ID
# 期待: GCP_PROJECT_ID=bananadish-prod
```

#### 4.4 ローカルシークレットファイル削除確認
```bash
# Firebase秘密鍵が削除されているか確認
ls ~/bananadish-firebase-key.json
# 期待: No such file or directory
```

### Section 5: Overall Integration Check

#### 5.1 GCP認証確認
```bash
# 現在のプロジェクト確認
gcloud config get-value project
# 期待: bananadish-prod

# Application Default Credentials確認
gcloud auth application-default print-access-token | head -c 20
# 期待: トークンが表示される (ya29...)
```

#### 5.2 Firebase認証確認
```bash
# 現在のプロジェクト確認
firebase projects:list | grep "(current)"
# 期待: bananadish-prod (current)
```

#### 5.3 ドキュメント確認
```bash
# セットアップドキュメントの存在確認
ls docs/setup/
# 期待:
# - firebase-config.md (任意)
# - gcp-project-info.md (任意)
# - local-dev-guide.md (必須)

cat docs/setup/local-dev-guide.md | grep "Prerequisites"
# 期待: Prerequisites セクションが存在
```

## Completion Criteria (DoD)

### T001 Checklist
- [ ] GCPプロジェクト `bananadish-prod` が ACTIVE 状態
- [ ] 4つの必須API (Cloud Run, Secret Manager, Cloud Build, Logging) が有効
- [ ] サービスアカウント `bananadish-backend@...` が存在
- [ ] サービスアカウントに3つのIAMロールが付与されている
- [ ] 予算アラート ¥50,000/月 が設定されている

### T002 Checklist
- [ ] Firebaseプロジェクトが GCP とリンクされている
- [ ] Authentication プロバイダー (Email, Google, Apple) が有効
- [ ] Firestore データベースが `asia-northeast1` に作成されている
- [ ] Firestore セキュリティルールがデプロイされている
- [ ] Firebase Analytics が有効化されている

### T003 Checklist
- [ ] Gemini API キーが Secret Manager に格納されている
- [ ] Firebase Service Account が Secret Manager に格納されている
- [ ] Gemini API接続テストが成功している
- [ ] ローカルのシークレットファイルが削除されている
- [ ] Git リポジトリが初期化され、`.gitignore` が機能している
- [ ] `.env.template` が作成されている
- [ ] 全ての開発ツール (Node.js, gcloud, Firebase CLI, Xcode, Git) がインストールされている
- [ ] `docs/setup/local-dev-guide.md` が存在する

### Phase 0 Overall
- [ ] 上記全てのチェックリストが完了している
- [ ] 検証コマンドが全て成功している
- [ ] Phase 1 (バックエンド開発) を開始する準備が整っている

## Verification Report Template

検証完了後、以下のレポートを `docs/verification/phase0-completion-report.md` に作成:

```markdown
# Phase 0 Completion Verification Report

**Date**: [実行日時]
**Verified by**: [実行者名]
**Status**: [PASS / FAIL]

## Summary

Phase 0 (Environment Setup) の全タスク (T001-T003) の検証を実施しました。

## Verification Results

### T001: GCP Project Setup
- [x] GCPプロジェクト作成: PASS
- [x] APIの有効化: PASS
- [x] サービスアカウント作成: PASS
- [x] IAMロール付与: PASS
- [x] 予算アラート設定: PASS

### T002: Firebase Project Setup
- [x] Firebaseプロジェクト作成: PASS
- [x] Authentication設定: PASS
- [x] Firestore作成: PASS
- [x] セキュリティルールデプロイ: PASS
- [x] Analytics有効化: PASS

### T003: Development Environment
- [x] Gemini APIキー取得: PASS
- [x] Secret Manager格納: PASS
- [x] Gemini API接続テスト: PASS
- [x] Git初期化: PASS
- [x] 開発ツール確認: PASS

## Issues Found

[問題が発生した場合に記載]

## Next Steps

Phase 1 (Backend Development) を開始する準備が整いました。
次のタスク: T101 (Backend Project Structure Setup)

## Appendix: Verification Commands Output

[各検証コマンドの実際の出力を記録]
```

## Troubleshooting

### 問題: API有効化の確認でAPIが不足
**解決策**:
```bash
# 不足しているAPIを個別に有効化
gcloud services enable run.googleapis.com --project=bananadish-prod
gcloud services enable secretmanager.googleapis.com --project=bananadish-prod
# ... 他のAPIも同様
```

### 問題: Gemini API接続テストが失敗
**解決策**:
```bash
# Generative Language APIが有効化されているか確認
gcloud services enable generativelanguage.googleapis.com --project=bananadish-prod

# APIキーを再取得してSecret Managerに更新
gcloud secrets versions add GEMINI_API_KEY --data-file=- <<< "新しいAPIキー"
```

### 問題: Firestoreセキュリティルールのデプロイエラー
**解決策**:
```bash
# プロジェクトを明示的に指定
firebase use bananadish-prod

# 再デプロイ
firebase deploy --only firestore:rules
```

## Deliverables

- `docs/verification/phase0-completion-report.md`: Phase 0検証完了レポート
- 全ての検証項目が PASS 状態

## Notes

- **Phase 1への前提条件**: このタスクが完全に完了するまで Phase 1 には進まない
- 1つでも検証項目が FAIL の場合、該当するタスク (T001-T003) に戻って修正
- 検証レポートは今後のトラブルシューティングのリファレンスとして保存

## Estimated Time
20-30分
