# Phase 3 Completion Verification

## フェーズ情報
- **フェーズ名**: Phase 3: Payment Integration
- **完了タスク**: T301, T302, T303, T304
- **検証実施日**: __________
- **検証担当者**: __________

## 概要
Phase 3の全タスクが完了し、Apple In-App Purchaseによるサブスクリプション機能が実装されたことを検証します。

## 完了タスクチェックリスト

- [ ] T301: Apple Developer & App Store Connect Setup
- [ ] T302: React Native IAP Integration
- [ ] T303: Backend Receipt Validation
- [ ] T304: Subscription Management UI

## E2E検証シナリオ (Sandbox)

### シナリオ1: Starter購入フロー (Sandbox)

**前提**: Sandboxテスターアカウント作成済み

**手順**:
1. iOS実機でアプリ起動 (Sandbox購入はシミュレーター不可)
2. テストアカウントでログイン
3. 設定タブ → サブスクリプション管理
4. 「Starterプランを購入」をタップ
5. 価格確認: ¥1,980/月
6. 特典確認: 月30回、高品質JPEG等
7. 「今すぐ購入する」をタップ
8. Sandboxサインインダイアログ表示
9. Sandboxテスターアカウントでサインイン
10. Touch ID/Face IDで認証
11. 「Environment: Sandbox」確認ダイアログ表示
12. 購入完了メッセージ表示
13. 設定タブで tier が「Starter」になっていることを確認
14. 使用制限が 30回 になっていることを確認
15. Firestore確認: `subscription.tier = 'starter'`, `usage.monthlyLimit = 30`

**検証結果**: [ ] PASS / [ ] FAIL

**レシートデータ取得確認**: [ ] 成功

**バックエンドレシート検証**: [ ] 成功

---

### シナリオ2: 追加生成購入 (Sandbox)

**手順**:
1. クォータを使い切る (無料プラン: 10回生成)
2. 11回目の生成を試行
3. クォータ超過モーダルが表示される
4. 「追加生成を購入 (¥980)」をタップ
5. 価格確認: ¥980
6. 「購入する」をタップ
7. Sandbox購入完了
8. 使用制限が +10 されることを確認 (例: 10 → 20)
9. Firestore確認: `usage.monthlyLimit` が増加

**検証結果**: [ ] PASS / [ ] FAIL

---

### シナリオ3: 購入の復元 (Sandbox)

**手順**:
1. アプリを削除
2. 再インストール
3. 同じテストアカウントでログイン
4. 設定タブで「購入の復元」をタップ
5. 復元成功メッセージ表示
6. プランが「Starter」に復元されることを確認
7. 使用制限が30回であることを確認

**検証結果**: [ ] PASS / [ ] FAIL

---

### シナリオ4: 購入キャンセル

**手順**:
1. 購入フロー開始
2. Sandboxサインイン画面で「キャンセル」をタップ
3. 適切なメッセージ表示 (エラーではなくキャンセル扱い)
4. アプリがクラッシュしないことを確認

**検証結果**: [ ] PASS / [ ] FAIL

---

## 機能チェックリスト

### T301: Apple Developer Setup
- [ ] Apple Developer Program登録完了 (¥12,800/年)
- [ ] App Store ConnectでBananaDishアプリ作成済み
- [ ] IAP製品「com.bananadish.starter.monthly」作成済み (準備完了)
- [ ] IAP製品「com.bananadish.addon.10gen」作成済み (準備完了)
- [ ] 価格設定: Starter ¥1,980/月、追加生成 ¥980
- [ ] Sandboxテスターアカウント 3つ作成済み
- [ ] Sandbox購入テスト成功

### T302: IAP Integration
- [ ] react-native-iap インストール済み
- [ ] IAP接続初期化成功
- [ ] 製品リスト取得成功 (Starter, 追加生成)
- [ ] サブスクリプション購入フロー動作
- [ ] 消費型購入フロー動作
- [ ] レシートデータ取得成功
- [ ] 購入キャンセル時のエラーハンドリング適切
- [ ] 購入の復元機能動作

### T303: Receipt Validation
- [ ] Apple Receipt検証ロジック実装済み
- [ ] Sandbox/Production環境自動切り替え動作
- [ ] POST /v1/subscription/validate-receipt エンドポイント実装
- [ ] 有効なレシート検証成功
- [ ] 無効なレシート時エラー返却
- [ ] Firestore更新成功 (subscription.tier, usage.monthlyLimit)
- [ ] 追加生成購入時にusage.monthlyLimit増加

### T304: Subscription UI
- [ ] アップグレードフロー実装
- [ ] 価格・特典表示
- [ ] 購入確認ダイアログ表示
- [ ] 購入成功メッセージ表示
- [ ] クォータ超過モーダル実装
- [ ] クォータ超過時に購入促進
- [ ] 購入復元ボタン動作
- [ ] 購入後にサブスクリプション情報自動更新
- [ ] 全UI日本語化

---

## App Store Connect確認

- [ ] IAP製品が「準備完了」ステータス
- [ ] 製品ID: `com.bananadish.starter.monthly`
- [ ] 製品ID: `com.bananadish.addon.10gen`
- [ ] 価格: ¥1,980/月, ¥980
- [ ] ローカリゼーション (日本語) 設定済み
- [ ] スクリーンショット (プレースホルダー) アップロード済み

---

## バックエンド確認

- [ ] Apple Shared Secret設定済み (Secret Manager)
- [ ] Receipt検証API動作
- [ ] Firestore更新ロジック動作
- [ ] エラーログなし (Cloud Logging)

---

## セキュリティ確認

- [ ] Apple Shared Secretがクライアントに露出していない
- [ ] レシート検証がバックエンドで実行される
- [ ] クライアントで直接IAP承認していない

---

## Phase 3 Acceptance Criteria (from Work Plan)

- [ ] IAP製品がApp Store Connectで設定済み
- [ ] 購入フローがEnd-to-Endで動作 (Sandbox)
- [ ] バックエンドでレシート検証が機能
- [ ] Firestoreのサブスクリプションデータが正しく更新される
- [ ] 購入の復元が動作
- [ ] クォータ強制がサブスクリプションtierを反映
- [ ] 全決済UIが日本語

---

## 発見された問題

| # | 重要度 | 内容 | 発見日 | ステータス | 担当 |
|---|-------|------|--------|-----------|------|
| 1 | | | | | |
| 2 | | | | | |

---

## 総合評価

**Phase 3完了可否**: [ ] 完了 / [ ] 未完了 (理由: _______________)

**次フェーズへの移行**: [ ] 可 / [ ] 不可

**備考**:
___________________________________________________________

---

## 承認

- **検証担当者**: ______________ 日付: __________
- **プロジェクトマネージャー**: ______________ 日付: __________

---

## 次のアクション

Phase 3完了後、Phase 4 (Integration & Deployment) に進みます:
- T401: End-to-End Testing
- T402: Performance Testing
- T403: App Store Submission
- T404: Production Deployment
