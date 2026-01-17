# T404: Production Deployment & Launch

## 基本情報
- **タスクID**: T404
- **フェーズ**: Phase 4: Integration & Deployment
- **依存タスク**: T403 (App Store Submission), T107 (Cloud Run Deployment)
- **成果物**:
  - App Store承認済みアプリ (Live)
  - プロダクションバックエンド稼働確認
  - 監視ダッシュボード設定
  - サポート体制準備
  - ロールバック手順書
- **推定時間**: 1日 + App Store審査待ち (1-7日)

## 概要
App Store審査の承認を受け、本番環境にリリースします。監視体制を整え、初期ユーザーサポートの準備を行います。

## Step 1: App Store審査対応

### 審査ステータス確認

App Store Connect で審査ステータスを監視:

**ステータス遷移**:
1. **審査待ち** → 提出完了
2. **審査中** → Appleレビュアーがテスト中
3. **追加情報が必要** → レビュアーからの質問に回答
4. **承認済み** → リリース可能
5. **却下** → 修正して再提出

### 審査中の対応

**レビュアーからの質問例**:
- "Gemini APIの使用目的は?"
  → 回答例: "料理写真のAI加工に使用しています。ユーザーの写真はサーバーに保存せず、処理後すぐに削除します。"

- "テストアカウントでログインできない"
  → 対応: App Store Connectのレビューノートを確認、正しいパスワードを再送信

**迅速対応**:
- メール通知を有効化
- 24時間以内に回答 (遅延すると審査が長引く)

---

## Step 2: バックエンド本番環境確認

### Cloud Run サービス確認

```bash
# サービスステータス確認
gcloud run services describe bananadish-api --region asia-northeast1

# 期待結果:
# ✓ Status: Ready
# ✓ URL: https://bananadish-api-XXXXXX.run.app
# ✓ Min instances: 1 (コールドスタート回避)
# ✓ Max instances: 10
# ✓ Memory: 2 GiB
# ✓ CPU: 2
# ✓ Timeout: 60s

# Health check
curl https://bananadish-api-XXXXXX.run.app/health
# 期待結果: {"status":"ok"}
```

### Secrets確認

```bash
# 必須シークレットの確認
gcloud secrets versions access latest --secret="GEMINI_API_KEY"
gcloud secrets versions access latest --secret="APPLE_SHARED_SECRET"
gcloud secrets versions access latest --secret="FIREBASE_SERVICE_ACCOUNT"

# 全てアクセス可能であることを確認
```

### Firestore確認

```bash
# Firestoreセキュリティルールが本番環境に適用されているか確認
firebase firestore:rules:get

# インデックスが作成されているか確認
firebase firestore:indexes

# テストユーザードキュメント確認 (Firebase Console)
# users/{testUserId} が存在し、正しい構造か
```

---

## Step 3: 監視・アラート設定

### Cloud Logging アラート

```bash
# エラーログアラート作成
gcloud logging metrics create backend-errors \
  --description="Backend error count" \
  --log-filter='resource.type="cloud_run_revision" AND severity>=ERROR'

# アラートポリシー作成
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_EMAIL_CHANNEL \
  --display-name="Backend Errors" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="logging.googleapis.com/user/backend-errors"'
```

### Cloud Monitoring ダッシュボード

**監視項目**:
1. **Request Count** (リクエスト数)
   - 正常: 0-500 req/hour (初期)
   - 警告: 1000 req/hour

2. **Response Time** (レスポンス時間)
   - 正常: 90th < 30秒
   - 警告: 90th > 40秒

3. **Error Rate** (エラー率)
   - 正常: < 1%
   - 警告: > 5%

4. **Instance Count** (インスタンス数)
   - Min: 1, Max: 10

**ダッシュボード作成**:
1. Cloud Console → Monitoring → Dashboards
2. "Create Dashboard" → "BananaDish Production"
3. 上記4つのチャートを追加

---

### Firebase Analytics ダッシュボード

**重要イベント**:
- `app_open`: DAU (Daily Active Users)
- `sign_up`: 新規登録数
- `generation_completed`: 生成成功数
- `purchase_completed`: 課金数

**目標設定**:
- Week 1: 50 downloads, 30 sign_ups
- Month 1: 300 registrations, 45 paying users

---

### Firebase Crashlytics 監視

**設定**:
1. Firebase Console → Crashlytics
2. Email alerts ON
3. Crash-free users target: > 99.5%

---

## Step 4: Budget Alert設定

```bash
# GCP予算アラート (¥50,000/月)
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="BananaDish Monthly Budget" \
  --budget-amount=50000JPY \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100

# アラート先メールアドレス設定
# → Billing → Budgets & alerts で確認
```

---

## Step 5: App Store リリース

### リリース方法選択

**オプション1: 即座にリリース** (推奨)
- 承認後すぐにApp Storeで公開
- App Store Connect → App情報 → 「このバージョンを自動的にリリース」

**オプション2: 段階的リリース** (Phased Release)
- 7日間かけて徐々にユーザーに配信
- サーバー負荷を分散
- App Store Connect → リリースオプション → 「段階的リリース」

**オプション3: 手動リリース**
- 承認後、任意のタイミングでリリース
- 特定の日時に合わせたい場合

### リリース当日の作業

**承認通知受信後**:

```bash
# 1. App Store Connectで確認
# ステータス: 「承認済み」→「販売準備完了」

# 2. リリースボタンをクリック (手動リリースの場合)
#    または自動リリースを待つ

# 3. App Storeで検索可能になるまで待つ (1-24時間)

# 4. App Storeリンク取得
# https://apps.apple.com/jp/app/bananadish/idXXXXXXXXXX

# 5. 実機でダウンロードテスト
# - App Storeから「BananaDish」で検索
# - ダウンロード
# - 起動確認
# - サインアップ→生成→保存の一連のフロー確認
```

---

## Step 6: 本番環境 E2E検証

### 本番購入テスト (実課金)

**注意**: Sandbox購入ではなく、実際の課金を1回テスト

**手順**:
1. 本番Apple IDでアプリをダウンロード
2. 新規アカウント作成
3. Starterプラン (¥1,980) を購入
4. **実際に課金される** (テスト後キャンセル可能)
5. 購入完了確認
6. Firestore確認: subscription.tier = 'starter'
7. 使用制限が30回になることを確認
8. サブスクリプションキャンセル (24時間以内なら返金可能)

**検証結果**: [ ] PASS / [ ] FAIL

### 本番生成テスト

**手順**:
1. 本番アプリで料理写真を選択
2. 生成実行
3. Cloud Logging確認: エラーなし
4. 生成時間測定: < 30秒
5. 4枚生成されることを確認
6. カメラロール保存確認

**検証結果**: [ ] PASS / [ ] FAIL

---

## Step 7: サポート体制準備

### サポートメール設定

**メールアドレス**: support@bananadish.app

**自動返信テンプレート**:
```
BananaDishサポートチームです。
お問い合わせありがとうございます。

24時間以内に担当者よりご返信いたします。

よくある質問:
- 生成が失敗する → ネットワーク接続を確認してください
- 写真が保存されない → 設定でフォトライブラリへのアクセスを許可してください
- 購入の復元 → 設定タブ→購入の復元

BananaDish サポートチーム
support@bananadish.app
```

### FAQページ作成

`docs/faq.md` を作成し、https://bananadish.app/faq で公開:

```markdown
# よくある質問 (FAQ)

## Q1: 生成が失敗します
A: 以下をお試しください:
- Wi-Fi接続を確認
- アプリを再起動
- 写真サイズを確認 (10MB以下)

## Q2: 写真がカメラロールに保存されません
A: 設定 → BananaDish → 写真 で「すべての写真へのアクセスを許可」を選択してください。

## Q3: サブスクリプションをキャンセルしたい
A: 設定 → [Apple ID] → サブスクリプション → BananaDish → キャンセル

## Q4: 購入を復元したい
A: アプリ内の「設定」タブ → 「購入の復元」をタップ
```

---

## Step 8: ロールバック手順書

### アプリのロールバック (緊急時)

**重大バグが発見された場合**:

```bash
# 1. App Store Connectで前バージョンに戻す
# → アプリのバージョンは戻せないため、修正版を緊急リリース

# 2. または アプリを一時的に削除
# App Store Connect → マイApp → BananaDish
# → 「このAppを削除」(最終手段)

# 3. 修正版を至急提出
# 緊急審査リクエストを送信
```

### バックエンドのロールバック

```bash
# Cloud Runで前バージョンにロールバック
gcloud run services update-traffic bananadish-api \
  --to-revisions=bananadish-api-PREVIOUS-REVISION=100 \
  --region asia-northeast1

# 確認
gcloud run revisions list --service=bananadish-api --region=asia-northeast1

# Firestoreはバックアップから復元
# Firebase Console → Firestore → Import/Export
```

---

## Step 9: ベータユーザー募集

### 初期ユーザー獲得

**ターゲット**: 飲食店経営者・スタッフ 10-20人

**募集方法**:
1. 飲食店協会へメール
2. SNS (Twitter/Instagram) で告知
3. 友人・知人への直接依頼

**フィードバック収集**:
- Google Form作成
- アプリ内フィードバックボタン (オプション)
- support@bananadish.app へのメール

**初期ユーザー特典** (オプション):
- 最初の50人に1ヶ月無料 (プロモコード発行)

---

## 完了条件（DoD）

- [ ] App Store審査承認済み
- [ ] App StoreでLive (ダウンロード可能)
- [ ] バックエンド本番環境が正常稼働
- [ ] 監視ダッシュボード設定完了
- [ ] アラート通知設定完了
- [ ] Budget alert設定完了
- [ ] 本番購入テスト成功
- [ ] 本番生成テスト成功
- [ ] サポートメール設定完了
- [ ] FAQページ公開済み
- [ ] ロールバック手順書作成済み
- [ ] ベータユーザー10人以上獲得

## 成果物

1. **App Store公開アプリ**: Live URL
2. **監視ダッシュボード**: Cloud Monitoring, Firebase Analytics
3. **アラート設定**: エラー、予算、クラッシュ
4. **サポート体制**: メール、FAQ
5. **ロールバック手順書**: `docs/rollback-procedures.md`
6. **初期ユーザーリスト**: 10-20人

## Post-Launch監視 (最初の1週間)

### Daily Check (毎日)

- [ ] Cloud Logging エラー確認
- [ ] Firebase Crashlytics クラッシュ確認
- [ ] サポートメール確認・返信
- [ ] App Store レビュー確認・返信
- [ ] ユーザー数・課金数確認

### Weekly Review (週次)

- [ ] KPI確認 (DL数、登録数、課金数)
- [ ] コスト確認 (GCP, Gemini API)
- [ ] ユーザーフィードバック分析
- [ ] 改善項目リストアップ

---

## トラブルシューティング

### 問題: App Store審査が却下された

**対応**:
1. 却下理由を確認 (Resolution Center)
2. 修正実施
3. 再提出 (通常2-3日で再審査)

**よくある却下理由**:
- プライバシーポリシー不備 → 詳細化
- テストアカウントエラー → 正しい認証情報提供
- IAP説明不足 → レビューノート詳細化

### 問題: 本番でエラー多発

**対応**:
1. Cloud Loggingでエラー内容確認
2. 緊急度判定 (Critical/High/Medium)
3. Critical: バックエンドロールバック
4. 修正版デプロイ
5. 監視継続

### 問題: コストが予算超過

**対応**:
1. GCP Billing確認: どのサービスがコスト高いか
2. Gemini API使用量確認
3. レート制限強化 (10req/min → 5req/min)
4. Min instances削減 (1 → 0) ※コールドスタート発生

---

## Notes

- **段階的リリース推奨**: サーバー負荷を分散
- **初期監視強化**: 最初の1週間は毎日確認
- **迅速対応**: バグは24時間以内に修正版提出
- **ユーザーファースト**: サポート対応を最優先
- **コスト監視**: 予算内に収まるよう日次確認

## 関連ドキュメント

- [実装計画書 - T404](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t404-production-deployment--launch)
- [Success Metrics](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#success-metrics--kpis)
- [Operational Verification](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#operational-verification-procedures)
