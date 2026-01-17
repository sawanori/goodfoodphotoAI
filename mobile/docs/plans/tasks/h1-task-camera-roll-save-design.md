# Task: カメラロール保存機能 実装計画書作成

## Metadata
- **Task ID**: h1-task-camera-roll-save-design
- **Priority**: High
- **Status**: pending
- **Assigned to**: Sonnet Task agent
- **Estimated time**: 30 minutes

## Context

### Problem Statement
生成された画像をカメラロールに保存する機能が未実装です。ユーザーが生成した画像を端末に保存できるようにする必要があります。

### Current State
- ImageGridコンポーネントは画像表示のみ実装済み
- expo-media-library (v18.2.1) インストール済み
- expo-file-system (v19.0.21) インストール済み
- 保存機能は未実装

### Requirements
1. 個別画像保存機能（各画像に保存ボタン）
2. 全画像一括保存機能（すべて保存ボタン）
3. パーミッション管理（MediaLibrary.requestPermissionsAsync）
4. base64形式の画像対応
5. ユーザーフィードバック（成功・エラーAlert）

## Task Objective
ImageGridコンポーネントにカメラロール保存機能を追加するための詳細な実装計画書を作成してください。

## Deliverables
以下の内容を含む実装計画書を作成すること:

### 1. 技術仕様
- [ ] 使用するライブラリとバージョン明記
- [ ] パーミッション処理フロー設計
- [ ] base64 / URI両対応の保存ロジック設計

### 2. コンポーネント設計
- [ ] ImageGridコンポーネントのprops拡張設計
- [ ] 保存関数のシグネチャ設計
- [ ] UIレイアウト設計（ボタン配置）

### 3. エラーハンドリング設計
- [ ] パーミッション拒否時の処理
- [ ] ファイル保存失敗時の処理
- [ ] ネットワークエラー時の処理

### 4. UIデザイン仕様
- [ ] 個別保存ボタンのスタイル
- [ ] 一括保存ボタンのスタイル
- [ ] ローディング状態の表示方法

### 5. 実装ステップ
- [ ] 段階的な実装手順の定義
- [ ] テスト観点の列挙

## Acceptance Criteria
- 実装計画書が上記すべてのDeliverables項目をカバーしている
- コードサンプルまたは疑似コードが含まれている
- エッジケース（パーミッション拒否、ネットワークエラー等）が考慮されている
- UIデザインがReact Nativeのベストプラクティスに従っている

## Dependencies
- /home/noritakasawada/project/20260117/mobile/components/ImageGrid.tsx
- /home/noritakasawada/project/20260117/mobile/package.json

## Output Location
実装計画書を以下のパスに作成してください:
`/home/noritakasawada/project/20260117/mobile/docs/plans/design/h1-camera-roll-save-design.md`
