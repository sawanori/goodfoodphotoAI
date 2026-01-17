# T001: GCP Project Setup

## Task Overview
Google Cloud Platform (GCP) プロジェクトを作成し、BananaDishアプリに必要な基本サービスとAPIを有効化する。請求アカウントをリンクし、予算アラートを設定してコスト管理を確立する。

## Dependencies
- なし (Phase 0の最初のタスク)
- 前提条件: GCPアカウント作成済み、請求設定可能な状態

## Target Files
このタスクでは新規ファイル作成は不要 (GCPコンソール上での設定作業)

参考用に以下のファイルを作成可能:
- `docs/setup/gcp-project-info.md` (任意: プロジェクトID等を記録)

## Implementation Steps

### Step 1: GCPプロジェクト作成

1. **GCPコンソールにアクセス**
   ```bash
   # ブラウザでアクセス
   open https://console.cloud.google.com/
   ```

2. **新規プロジェクト作成**
   - Console上部の「プロジェクトを選択」→「新しいプロジェクト」
   - プロジェクト名: `BananaDish Production`
   - プロジェクトID: `bananadish-prod` (利用可能な場合)
     - 注意: IDは全GCPで一意である必要があるため、既に使用されている場合は `bananadish-prod-<ランダム文字列>` となる
   - 組織: なし (個人アカウントの場合)
   - 「作成」をクリック

3. **プロジェクトIDを確認・記録**
   ```bash
   # CLIで確認する場合 (gcloud初期化後)
   gcloud config get-value project
   ```

### Step 2: 請求アカウントのリンク

1. **請求設定**
   - 左メニュー「お支払い」→「アカウントをリンク」
   - 既存の請求アカウントを選択、または新規作成
   - 「アカウントを設定」をクリック

2. **請求が有効か確認**
   ```bash
   gcloud beta billing projects describe bananadish-prod
   # billingEnabled: true となっていることを確認
   ```

### Step 3: 必要なAPIの有効化

以下のAPIを有効化する:

```bash
# gcloud CLIでプロジェクトを設定
gcloud config set project bananadish-prod

# 必要なAPIを一括有効化
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  cloudresourcemanager.googleapis.com

# 有効化されたAPIを確認
gcloud services list --enabled
```

**有効化されるべきAPI**:
- Cloud Run API (`run.googleapis.com`)
- Secret Manager API (`secretmanager.googleapis.com`)
- Cloud Build API (`cloudbuild.googleapis.com`)
- Cloud Logging API (`logging.googleapis.com`)
- Cloud Resource Manager API (`cloudresourcemanager.googleapis.com`)

### Step 4: 予算アラートの設定

1. **GCPコンソールで設定**
   - 左メニュー「お支払い」→「予算とアラート」
   - 「予算を作成」をクリック

2. **予算の詳細**
   - 名前: `BananaDish Monthly Budget`
   - プロジェクト: `bananadish-prod` を選択
   - サービス: すべてのサービス
   - 期間: 毎月

3. **予算額の設定**
   - 予算タイプ: 指定額
   - ターゲット額: `50,000` JPY
   - 「次へ」

4. **アラートのしきい値**
   - 50% (¥25,000)
   - 90% (¥45,000)
   - 100% (¥50,000)
   - 通知先: 自分のメールアドレス
   - 「完了」

### Step 5: サービスアカウントの作成

Cloud Run用のサービスアカウントを作成:

```bash
# サービスアカウント作成
gcloud iam service-accounts create bananadish-backend \
  --display-name="BananaDish Backend Service Account" \
  --description="Service account for Cloud Run backend"

# サービスアカウント名を確認
gcloud iam service-accounts list

# Secret Manager Secret Accessor ロールを付与
gcloud projects add-iam-policy-binding bananadish-prod \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Datastore User ロール付与 (Firestore用)
gcloud projects add-iam-policy-binding bananadish-prod \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Logs Writer ロール付与
gcloud projects add-iam-policy-binding bananadish-prod \
  --member="serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"
```

## Completion Criteria (DoD)

以下の全ての項目が満たされていることを確認:

- [ ] GCPプロジェクト `bananadish-prod` が作成されている
- [ ] 請求アカウントがリンクされている
- [ ] 以下のAPIが有効化されている:
  - [ ] Cloud Run API
  - [ ] Secret Manager API
  - [ ] Cloud Build API
  - [ ] Cloud Logging API
  - [ ] Cloud Resource Manager API
- [ ] 予算アラート (¥50,000/月) が設定されている
- [ ] サービスアカウント `bananadish-backend@bananadish-prod.iam.gserviceaccount.com` が作成されている
- [ ] サービスアカウントに以下の権限が付与されている:
  - [ ] Secret Manager Secret Accessor
  - [ ] Cloud Datastore User
  - [ ] Cloud Logging Log Writer

## Verification Commands

```bash
# プロジェクト情報の確認
gcloud projects describe bananadish-prod

# 有効化されたAPIのリスト
gcloud services list --enabled --project=bananadish-prod

# サービスアカウントの確認
gcloud iam service-accounts list --project=bananadish-prod

# サービスアカウントのIAMポリシー確認
gcloud projects get-iam-policy bananadish-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:bananadish-backend@bananadish-prod.iam.gserviceaccount.com"

# 予算アラートの確認 (GCPコンソールで視覚的に確認)
open https://console.cloud.google.com/billing/budgets
```

**期待される結果**:
- `gcloud projects describe`: projectId が `bananadish-prod` と表示される
- `gcloud services list --enabled`: 上記5つのAPIが含まれている
- サービスアカウントリストに `bananadish-backend` が表示される
- IAMポリシーに3つのロールが付与されている

## Troubleshooting

### 問題: プロジェクトIDが既に使用されている
**解決策**:
- `bananadish-prod-YYYYMMDD` (例: `bananadish-prod-20260117`) の形式で作成
- 以降の全タスクで使用するプロジェクトIDを更新

### 問題: 請求アカウントがない
**解決策**:
- GCPコンソール → お支払い → 請求アカウントを作成
- クレジットカード情報を登録
- 初回は無料クレジット ($300) が利用可能

### 問題: APIの有効化でエラー
**解決策**:
```bash
# 個別に有効化を試す
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
# ... 残りも個別に実行
```

## Deliverables

- GCPプロジェクトID: `bananadish-prod` (または実際に作成されたID)
- サービスアカウントメールアドレス: `bananadish-backend@bananadish-prod.iam.gserviceaccount.com`
- 有効化されたAPI群: Cloud Run, Secret Manager, Cloud Build, Logging, Resource Manager

## Notes

- このタスクは**Phase 0の基盤**となるため、確実に完了させること
- プロジェクトIDは後続のタスク (T002, T003, Phase 1) 全てで使用される
- 予算アラートは必須 - コスト超過を防ぐための重要な防御策
- サービスアカウントはT107 (Cloud Run Deployment) で使用される

## Estimated Time
30-45分 (GCPアカウント作成済みの場合)
