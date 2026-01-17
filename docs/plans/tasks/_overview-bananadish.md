# Overall Design Document: BananaDish Implementation

Generation Date: 2026-01-17
Target Plan Document: bananadish-workplan.md

## Project Overview

### Purpose and Goals
BananaDishアプリの実装を、独立した検証可能なタスクに分解し、React Native/Node.js初心者でも実行可能な形で段階的に開発する。Phase 0(環境構築)とPhase 1(バックエンド開発)を優先的に完了させ、AI画像生成機能の基盤を確立する。

### Background and Context
- 料理写真をプロ級に変換するAI駆動iOSアプリ
- 開発者はReact Native/Node.js初心者
- セキュリティ最優先: Gemini API keyは絶対にクライアントに含めない
- 予算制約: 500ユーザーで月額5万円以内
- MVP範囲: iOS先行リリース、日本語のみ

## Task Division Design

### Division Policy
**垂直スライス戦略**: 各Phaseは独立してデプロイ・検証可能な単位として設計

**検証可能性レベル分布**:
- Phase 0 (環境構築): L1 (運用検証) - CLIコマンドで検証
- Phase 1 (バックエンド): L2 (統合テスト) - curl/Postmanで検証
- Phase 2 (フロントエンド): L2/L3 (E2Eテスト) - 実機で検証
- Phase 3 (決済): L3 (E2Eテスト) - Sandbox環境で検証
- Phase 4 (統合): L3 (E2Eテスト) - 本番環境で検証

**タスク粒度基準**:
- Small (推奨): 1-2ファイル変更
- Medium (許容): 3-5ファイル変更
- Large (分割必須): 6+ファイル変更

### Inter-task Relationship Map

```
Phase 0: Environment Setup (前提条件の確立)
├─ T001: GCP Project Setup
│   └─ Deliverable: GCPプロジェクトID、有効化されたAPI群
├─ T002: Firebase Project Setup
│   └─ Deliverable: FirebaseプロジェクトID、Auth設定、Firestore
├─ T003: Development Environment
│   └─ Deliverable: Secret Managerに格納された認証情報
└─ Phase0-Completion: Phase 0完了検証
    └─ Deliverable: 全環境の動作確認レポート

Phase 1: Backend Development (API基盤構築)
├─ T101: Backend Project Structure
│   └─ Deliverable: bananadish-backend/ プロジェクト
├─ T102: Authentication Middleware (T101依存)
│   └─ Deliverable: src/middleware/auth.ts
├─ T103: Image Processing Pipeline (T101依存)
│   └─ Deliverable: src/services/imageProcessor.ts
├─ T104: Gemini AI Integration (T101, T003依存)
│   └─ Deliverable: src/services/geminiClient.ts
├─ T105: Generate API Endpoint (T102, T103, T104依存)
│   └─ Deliverable: src/routes/generate.ts
├─ T106: Subscription API Endpoint (T102依存)
│   └─ Deliverable: src/routes/subscription.ts
├─ T107: Cloud Run Deployment (T101-T106依存)
│   └─ Deliverable: 本番稼働中のAPI URL
└─ Phase1-Completion: Phase 1完了検証
    └─ Deliverable: E2E API検証レポート
```

### Interface Change Impact Analysis

| 既存インターフェース | 新規インターフェース | 変換必要性 | 対応タスク |
|-------------------|------------------|-----------|----------|
| N/A (Greenfield) | Firebase Auth SDK | なし | T002, T102 |
| N/A (Greenfield) | Gemini 2.5 Flash Image API | なし | T104 |
| N/A (Greenfield) | Apple IAP SDK | なし | Phase 3 |

### Common Processing Points

**Phase 0-1間で共通利用される要素**:
- **Secret Manager**: T003で構築、T104とT107で利用
- **Firebase Admin SDK**: T002で設定、T102で初期化
- **TypeScript設定**: T101で構築、T102-T106で継承

**重複実装の防止策**:
- 認証ミドルウェア(T102)を先行実装し、T105とT106で再利用
- 画像処理パイプライン(T103)を独立したモジュールとして実装
- Geminiクライアント(T104)をシングルトンパターンで実装

## Implementation Considerations

### Principles to Maintain Throughout

1. **セキュリティファースト**: API keyは絶対にクライアントに含めない
2. **検証可能性**: 各タスク完了時に動作確認可能なコマンド/手順を提供
3. **段階的構築**: 依存関係を最小化し、並列実行可能なタスクを明確化
4. **初心者フレンドリー**: 具体的なコマンド例とコードサンプルを含める
5. **1コミット1タスク**: 各タスクは単一コミットで完結する粒度

### Risks and Countermeasures

**Phase 0リスク**:
- リスク: GCP/Firebaseアカウント設定の不備
- 対策: チェックリスト形式でDoD定義、各ステップで検証コマンド実行

**Phase 1リスク**:
- リスク: Gemini APIが4枚未満の画像を返す
- 対策: T104でリトライロジック実装(最大3回試行)
- リスク: Cloud Run コールドスタート遅延
- 対策: T107で最小インスタンス数1を設定

### Impact Scope Management

**Phase 0変更許可スコープ**:
- GCPプロジェクト設定
- Firebaseプロジェクト設定
- ローカル開発環境の.envファイル
- .gitignore (シークレット除外)

**Phase 1変更許可スコープ**:
- bananadish-backend/ 配下の全ファイル
- Dockerfile
- cloudbuild.yaml
- Firestore security rules (Phase 0で初期設定済み)

**変更禁止領域** (Phase 0-1):
- フロントエンドコード (Phase 2以降)
- 決済ロジック (Phase 3以降)
- App Store設定 (Phase 4以降)

## Task Decomposition Checklist

- [x] 前タスクの成果物パスが後続タスクで指定されている
- [x] 調査タスクの成果物ファイル名が指定されている
- [x] 共通処理の識別と共有設計 (認証MW、画像処理、Geminiクライアント)
- [x] タスク依存関係と実行順序の明確化
- [x] 各タスクの影響範囲と境界の定義
- [x] 適切な粒度 (各タスク1-5ファイル)
- [x] 明確な完了基準の設定
- [x] 全体設計ドキュメント作成
- [x] 実装効率とやり直し防止 (共通処理の事前識別、影響範囲の明確化)

## Execution Order Recommendation

**最優先実行 (Phase 0)**: 並列実行不可、順次実行必須
1. T001: GCP Project Setup
2. T002: Firebase Project Setup (T001依存)
3. T003: Development Environment (T001, T002依存)
4. Phase0-Completion

**次優先実行 (Phase 1)**: 一部並列実行可能
1. T101: Backend Project Structure
2. T102 + T103 + T104 (T101完了後、並列実行可能)
3. T105 (T102, T103, T104完了後)
4. T106 (T102完了後、T105と並列可能)
5. T107 (T105, T106完了後)
6. Phase1-Completion

**Phase 2以降**: 別途優先順位決定 (Phase 1完了後に判断)

## Next Steps

Phase 0とPhase 1のタスクファイルを生成後、以下の順序で実行:

1. T001-T003を順次実行 (Phase 0)
2. Phase0-Completionで全環境の動作確認
3. T101を実行 (Phase 1開始)
4. T102/T103/T104を並列実行
5. T105とT106を実行
6. T107でCloud Runデプロイ
7. Phase1-CompletionでAPI全体の動作確認

各タスク完了時に必ずコミットを作成し、検証コマンドで動作確認すること。
