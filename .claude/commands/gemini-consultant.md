---
name: gemini-consultant
description: Google Gemini 3.0 APIを使用したセカンドオピニオン、コード分析、アイデア出しを実行する。Claude Codeの推論に対する「壁打ち」や、別の視点（Google検索データ含む最新情報など）からの提案が必要な場合に使用。 使用場面: (1) 実装方針のセカンドオピニオン, (2) コードレビュー依頼, (3) 最新ドキュメントに基づく調査, (4) 複雑なエラーの多角的分析。 トリガー: "gemini", "ジェミニ", "セカンドオピニオン", "geminiで分析", "/gemini"
---

# Gemini Consultant

Gemini CLIを使用して、現在のコンテキストに基づいたコードレビュー・分析・提案を実行するスキル。
Claudeとは異なるLLMの視点を取り入れることで、実装の堅牢性を高めるために使用する。

**重要: 必ずGemini 3.0系モデルを使用すること。3.0未満のモデル（1.5、2.0等）は使用禁止。**

## 実行コマンド

```bash
gemini exec --model gemini-3.0-pro --context <project_directory> "<request>"
```

## パラメータ

| パラメータ | 説明 |
|-----------|------|
| `--model <name>` | 使用モデル: `gemini-3.0-pro` または `gemini-3.0-flash` のみ使用可 |
| `--context <dir>` | コンテキストとして読み込むディレクトリパス |
| `"<request>"` | Geminiへの依頼内容（日本語可） |

## 利用可能モデル

| モデル名 | 用途 |
|---------|------|
| `gemini-3.0-pro` | 高精度な分析・レビュー（推奨） |
| `gemini-3.0-flash` | 高速なレスポンスが必要な場合 |

※ gemini-1.5-pro、gemini-2.0-flash 等の旧モデルは使用しないこと

## 使用例

### セカンドオピニオン（実装方針の相談）
```bash
gemini exec --model gemini-3.0-pro --context . "現在提案されているこの実装方針について、セキュリティの観点から懸念点があれば指摘してください"
```

### コードレビュー（別視点）
```bash
gemini exec --model gemini-3.0-pro --context src/auth "この認証ロジックにエッジケースの漏れがないかレビューしてください"
```

### 最新ドキュメント調査
```bash
gemini exec --model gemini-3.0-pro --context . "React 19の最新のServer Components仕様について教えてください"
```

### エラー分析
```bash
gemini exec --model gemini-3.0-pro --context . "以下のエラーの原因と解決策を分析してください: [エラーメッセージ]"
```

### 高速レスポンスが必要な場合
```bash
gemini exec --model gemini-3.0-flash --context . "このコードの概要を簡潔に説明してください"
```

## 実行手順

1. ユーザーからGeminiへの依頼を受け取る
2. 分析に必要なコンテキスト（ディレクトリ範囲）を特定する
3. 上記コマンド形式でGemini CLIを実行（必ず3.0系モデルを指定）
4. Geminiからの応答（標準出力）を読み取り、Claude Codeの文脈に合わせてユーザーに提示する

## 注意事項

- **Gemini 3.0系モデルのみ使用可（1.5、2.0等は使用禁止）**
- Gemini CLIが事前にインストールされている必要があります
- APIキーが環境変数 `GEMINI_API_KEY` に設定されている必要があります
- 大きなコンテキストを渡す場合はトークン制限に注意してください
