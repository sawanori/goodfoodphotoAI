# T401: End-to-End Integration Testing

## 基本情報
- **タスクID**: T401
- **フェーズ**: Phase 4: Integration & Deployment
- **依存タスク**: T206 (Results Display & Save), T304 (Subscription UI)
- **成果物**:
  - E2Eテスト計画書
  - テスト実行記録
  - バグトラッキングシート
  - Analyticsイベント検証レポート
- **推定時間**: 1日

## 概要
全ユーザーフローをEnd-to-Endでテストし、統合問題を発見・修正します。Firebase Analytics、Crashlyticsの動作確認も含みます。

## 前提条件
- [ ] Phase 2完了 (フロントエンド全機能実装済み)
- [ ] Phase 3完了 (決済機能実装済み)
- [ ] Firebase Analytics/Crashlytics設定済み
- [ ] テスト用iOS実機 3台以上 (iOS 14, 16, 17)

## テストシナリオ

### シナリオ1: 新規ユーザーオンボーディング→初回生成→保存

**手順**:
1. アプリを初回起動
2. オンボーディング画面を確認 (3画面)
3. スキップボタンで飛ばせることを確認
4. サインアップ画面で新規アカウント作成
5. ホーム画面が表示されることを確認
6. 「写真を選択」をタップ
7. ギャラリーから料理写真を選択
8. アスペクト比「4:5」を選択
9. 「生成する」をタップ
10. ローディング画面が表示されることを確認 (30秒以内)
11. 4枚の画像がグリッド表示されることを確認
12. 「全て保存する」をタップ
13. パーミッション許可
14. 保存成功メッセージ確認
15. 写真アプリで「BananaDish」アルバムに4枚保存確認

**期待結果**:
- [ ] オンボーディングがスムーズ
- [ ] サインアップ成功
- [ ] 生成が30秒以内に完了
- [ ] 4枚全て表示される
- [ ] 保存成功
- [ ] Analytics: `sign_up`, `generation_started`, `generation_completed`, `images_saved` イベント発火

**実行結果**: [ ] PASS / [ ] FAIL

---

### シナリオ2: 既存ユーザーログイン→クォータチェック

**手順**:
1. アプリ起動
2. ログイン画面でメール/パスワード入力
3. ログイン成功、ホーム画面表示
4. 設定タブで使用状況確認 (例: 1 / 10 回)
5. ホームに戻り写真生成を9回実行
6. 設定タブで使用状況が 10 / 10 になることを確認
7. 11回目の生成を試行
8. クォータ超過モーダルが表示されることを確認

**期待結果**:
- [ ] ログイン成功
- [ ] 使用カウントが正確
- [ ] クォータ超過モーダル表示
- [ ] Analytics: `login`, `generation_started` (x9), `quota_exceeded` イベント発火

**実行結果**: [ ] PASS / [ ] FAIL

---

### シナリオ3: 無料→Starter購入→生成

**手順**:
1. クォータ超過モーダルで「Starterプランにアップグレード」をタップ
2. アップグレード画面で価格確認 (¥1,980/月)
3. 「今すぐ購入する」をタップ
4. Sandbox購入ダイアログでサインイン
5. Touch ID/Face IDで認証
6. 購入完了メッセージ確認
7. 設定タブでプランが「Starter」になっていることを確認
8. 使用制限が 30回 になっていることを確認
9. ホームで生成を実行
10. 成功することを確認

**期待結果**:
- [ ] Sandbox購入成功
- [ ] プランが即座に更新される
- [ ] 使用制限が30回に増加
- [ ] 生成が実行可能
- [ ] Analytics: `purchase_initiated`, `purchase_completed` イベント発火

**実行結果**: [ ] PASS / [ ] FAIL

---

### シナリオ4: 追加生成購入

**手順**:
1. クォータ超過モーダルで「追加生成を購入」をタップ
2. 価格確認 (¥980)
3. 購入実行 (Sandbox)
4. 使用制限が +10 されることを確認
5. 生成を実行して成功確認

**期待結果**:
- [ ] 追加生成購入成功
- [ ] 使用制限が即座に増加
- [ ] 生成可能
- [ ] Analytics: `addon_purchased` イベント発火

**実行結果**: [ ] PASS / [ ] FAIL

---

### シナリオ5: 購入の復元

**手順**:
1. アプリを削除
2. 再インストール
3. ログイン
4. 設定タブで「購入の復元」をタップ
5. 復元成功メッセージ確認
6. プランが「Starter」であることを確認
7. 使用制限が30回であることを確認

**期待結果**:
- [ ] 購入が正常に復元される
- [ ] サブスクリプション情報が復元される
- [ ] Analytics: `restore_purchases` イベント発火

**実行結果**: [ ] PASS / [ ] FAIL

---

### シナリオ6: エラーシナリオ

#### 6-1: オフライン生成試行

**手順**:
1. 機内モードON
2. 生成を試行
3. ネットワークエラーメッセージ確認
4. 機内モードOFF
5. 再試行して成功確認

**期待結果**:
- [ ] オフライン時に適切なエラーメッセージ
- [ ] オンライン復帰後に正常動作

**実行結果**: [ ] PASS / [ ] FAIL

#### 6-2: 不正な画像選択

**手順**:
1. 非画像ファイル (PDF等) を選択試行
2. バリデーションエラー確認

**期待結果**:
- [ ] 画像以外は選択できない
- [ ] または選択時にエラーメッセージ

**実行結果**: [ ] PASS / [ ] FAIL

---

## Firebase Analytics検証

### 必須イベント確認

```bash
# Firebase Consoleで以下のイベントを確認
# https://console.firebase.google.com/ → Analytics → Events

必須イベント:
- app_open: アプリ起動時
- sign_up: 新規登録時
- login: ログイン時
- generation_started: 生成開始時
- generation_completed: 生成完了時
- images_saved: 画像保存時
- purchase_initiated: 購入開始時
- purchase_completed: 購入完了時
- quota_exceeded: クォータ超過時
```

**検証方法**:
1. Firebase Console → Analytics → DebugView
2. iOS実機をUSB接続
3. Xcode → Product → Scheme → Edit Scheme → Run → Arguments
4. `-FIRDebugEnabled` を追加
5. アプリ実行、イベントがリアルタイムで表示されることを確認

**検証結果**: [ ] 全イベント正常

---

## Firebase Crashlytics検証

### テストクラッシュ発生

`app/(tabs)/settings.tsx` に一時的に追加:

```typescript
import crashlytics from '@react-native-firebase/crashlytics';

// テスト用ボタン (本番では削除)
<TouchableOpacity onPress={() => crashlytics().crash()}>
  <Text>Test Crash (DEBUG ONLY)</Text>
</TouchableOpacity>
```

**手順**:
1. テストクラッシュボタンをタップ
2. アプリがクラッシュすることを確認
3. アプリを再起動
4. Firebase Console → Crashlytics でクラッシュレポート確認 (数分後)

**検証結果**: [ ] Crashlyticsでレポート受信

---

## デバイス互換性テスト

### テスト対象デバイス

| デバイス | iOSバージョン | 画面サイズ | テスト結果 |
|---------|-------------|-----------|-----------|
| iPhone 8 | iOS 14.0 | 4.7" | [ ] PASS / [ ] FAIL |
| iPhone 12 | iOS 16.0 | 6.1" | [ ] PASS / [ ] FAIL |
| iPhone 15 | iOS 17.0 | 6.1" | [ ] PASS / [ ] FAIL |
| iPhone 15 Pro Max | iOS 17.0 | 6.7" | [ ] PASS / [ ] FAIL |

**確認項目**:
- [ ] レイアウト崩れがない
- [ ] タップ操作が正常
- [ ] カメラ/ギャラリーが正常動作
- [ ] 画像保存が正常
- [ ] IAP購入が正常

---

## バグトラッキング

### 発見バグの記録

| #  | 重要度 | 発見日 | 内容 | 再現手順 | ステータス | 修正担当 |
|----|-------|--------|------|---------|-----------|---------|
| 1  | High  | 2026-01-XX | (例) 生成失敗時に無限ローディング | ... | Open | Backend |
| 2  | Medium | 2026-01-XX | ... | ... | Fixed | Frontend |

**重要度**:
- Critical: アプリが使用不可
- High: 主要機能が動作しない
- Medium: 一部機能に問題
- Low: UI/UXの軽微な問題

---

## 完了条件（DoD）

- [ ] 全シナリオ(1-6)が実行され、PASSしている
- [ ] 3台以上のデバイスでテストし、全てPASS
- [ ] Firebase Analyticsで全必須イベントが発火確認
- [ ] Crashlyticsでテストクラッシュが検出確認
- [ ] Criticalバグが0件
- [ ] Highバグが全て修正済み
- [ ] バグトラッキングシートが更新されている
- [ ] テスト実行記録が文書化されている

## 成果物

1. **E2Eテスト実行記録**: 全シナリオの実行結果を記録
2. **バグトラッキングシート**: 発見バグと修正ステータス
3. **Analyticsイベント検証レポート**: 全イベントの発火確認
4. **デバイス互換性レポート**: 各デバイスでの動作確認結果

## Notes

- **リグレッションテスト**: バグ修正後は必ず全シナリオを再実行
- **実機必須**: IAP、カメラはシミュレーターで動作しない
- **Sandbox環境**: 全てSandbox購入を使用 (本番課金しない)
- **Analytics遅延**: イベントがFirebase Consoleに反映されるまで数分かかる

## 関連ドキュメント

- [実装計画書 - T401](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#t401-end-to-end-integration-testing)
- [Quality Assurance Checklist](/home/noritakasawada/project/20260117/docs/plans/bananadish-workplan.md#quality-assurance-checklist)
