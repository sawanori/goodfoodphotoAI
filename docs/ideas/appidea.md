# アプリ開発レスト（店長向け：料理写真→AIで4枚生成→保存）

このファイルは「会話で決まった仕様」と「実装に必要な材料（API設計・コード雛形・デプロイ手順）」を、他の生成AIがそのまま実装に落とせる粒度でまとめたもの。

---

## 0. 概要YAML（最初に読む）

```yaml
app_name_working: "(仮) BananaDish"
target_user: "飲食店の店長（SNS投稿の画像づくりを時短したい）"
platform:
  mvp: "iOS"  # ただしReact Nativeで作り将来Androidも視野
  tech: "React Native (Expo)"
core_flow:
  - "料理写真を1枚撮影/選択"
  - "Gemini 2.5 Flash Image（Nano Banana）で4枚生成（4枚固定）"
  - "4枚をカメラロールに保存して終了"
constraints:
  aspect_ratio:
    crop_allowed: false
    method: "contain + blurred background"
  output_count: 4
  user_ops:
    customer_side_setup: false
  security:
    no_ai_api_key_in_app: true
hosting:
  principle: "手離れ重視（運用工数最小）"
  recommended: "Cloud Run + thin proxy backend"
pricing_suggestion:
  plan: "Starter"
  monthly_jpy: 1980
  included_generations_per_month: 30
  add_on:
    generations: 10
    price_jpy: 980
notes:
  - "モデル出力解像度は制限があり得る（Flash Imageは~1024px級）"
  - "生成画像にはSynthID透かしが付く可能性"
```

---

## 1. 会話から抽出した要件・意思決定

### 1.1 顧客/運用の前提（手離れ最優先）
- 顧客に「ホスティング設定」「ファイル配置」「CMS構築」等をさせない
- こちら側も案件ごとに運用が増える構成は避ける
- つまり「アプリ入れて使うだけ」に寄せる

### 1.2 アプリの価値
- 店長が“料理を撮るだけ”で、SNSに載せられる見栄えの画像が一気に4枚できる
- 編集知識（Lightroom等）不要

### 1.3 画像要件
- 生成は4枚固定
- アスペクト比を揃えたい
- ただし「短期でトリミング（見切れ）」はNG
  - ⇒ contain（余白で調整）が必須
  - 余白は単色だと安っぽいので、ぼかし背景で自然に埋める

---

## 2. MVP仕様

### 2.1 画面（最小）
1) 撮影/選択
2) 生成中（進捗は雰囲気でOK）
3) 結果（4枚グリッド）
4) 「4枚まとめて保存」

### 2.2 最初のアスペクト比（推奨）
- **4:5**（Instagramフィードで使いやすい）
- 次点：9:16（ストーリー/Reels）

### 2.3 画像整形アルゴリズム（見切れNG版）
出力サイズ（例：1080x1350＝4:5）に対して以下を適用。
1. 背景：元画像を outputSize に cover リサイズ（見切れOK）→ 強めに blur
2. 前景：元画像を outputSize に contain リサイズ（見切れなし）
3. 背景の中央に前景を合成

サーバー側で `sharp` 等で確定処理にすると「端末差」「実装ブレ」を減らせる。

---

## 3. 推奨アーキテクチャ（手離れ最優先）

### 3.1 なぜ“バックエンド薄いプロキシ”が必要か
- **AIのAPIキーをアプリに入れると漏洩が現実的**（リバースで抜かれる）
- 抜かれたら第三者が叩けて **課金事故** が起きる
- 画像整形（比率）も端末側よりサーバーが安定

### 3.2 構成
- Client：React Native（Expo）
- Backend：Cloud Run（Node/Express）
- AI：Gemini 2.5 Flash Image（`gemini-2.0-flash-exp`）
- Storage：当面ナシ（生成結果は署名URLで短期配布 or base64で返す）
- Auth：Firebase Auth（匿名ログインでもOK）→ IDトークンをCloud Runで検証

### 3.3 重要な制約メモ
- Gemini Flash Image の出力解像度は最大1024px級の前提があるため、
  - SNS標準の1080pxに合わせる場合は「軽いアップスケール」を許容する
  - もしくは、出力は1024基準にしてアプリ側で投稿時に任せる（ただし体験は荒れる）

---

## 4. API設計（最小）

### 4.1 エンドポイント
#### POST /v1/generate
- 目的：入力画像1枚 → AIで4枚生成 → アスペクト比整形して返す

リクエスト（multipart/form-data）
- image: file (jpg/png)
- aspect: string enum ['4:5','9:16']
- style: string optional（例：'natural','bright','moody' など）

ヘッダー
- Authorization: Bearer <Firebase ID Token>

レスポンス（JSON）
```json
{
  "aspect": "4:5",
  "count": 4,
  "images": [
    {"mime": "image/jpeg", "b64": "..."},
    {"mime": "image/jpeg", "b64": "..."},
    {"mime": "image/jpeg", "b64": "..."},
    {"mime": "image/jpeg", "b64": "..."}
  ]
}
```

> 実運用は base64 だとサイズが重いので、Cloud Storage に置いて署名URL返却に切り替えるのが王道。

### 4.2 失敗時
- 429：月間枠/分間枠を超過
- 401：トークン不正
- 400：画像なし/形式不正
- 502：AI応答不正（4枚返らない等）

---

## 5. プロンプト設計（たたき台）

目的：料理は変えすぎず、写真として自然に“美味しそうさ”を上げる。

日本語例（入力画像 + テキスト）
```text
この料理写真をベースに、料理そのものは変えずに、より美味しそうに見える写真を4パターン作ってください。
条件:
- 料理の形や盛り付けは維持（別料理にしない）
- 照明だけを改善（自然光/柔らかいトップライトなど）
- ツヤと質感を上げる（油・ソース・水分の立体感）
- 背景はうるさくしない（被写体が主役）
- 文字やロゴは入れない
出力は写真風、リアル。
```

運用のコツ
- 4枚が不足したら、同じ入力で「バリエーションを変えて不足分だけ追加生成」するリトライをバックエンドで行う

---

## 6. 価格・課金の考え方（初期案）

### 6.1 API費用の基本構造
- 「1回の生成＝4枚」なので、原価は“画像単価×4”で増える
- 無制限プランは短期で事故りやすい（ヘビーユーザーが出ると赤字）

### 6.2 売れやすい初期プラン（たたき台）
- Starter：月1980円 / 30回（=120枚）
- 追加：10回 980円

---

## 7. 実装の雛形（サンプルコード）

以下は「そのまま動く最小骨格」。本番はエラーハンドリング/リトライ/署名URL等を足す。

### 7.1 Backend（Node.js / Express）

> Cloud Runに載せる想定。TypeScriptでもJSでもOK。ここではJSで短く書く。

#### package.json（例）
```json
{
  "name": "banana-proxy",
  "type": "module",
  "private": true,
  "scripts": {"start": "node server.js"},
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.5",
    "firebase-admin": "^12.5.0"
  }
}
```

#### server.js（最小）
```js
import express from "express";
import multer from "multer";
import sharp from "sharp";
import admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Cloud Run: サービスアカウントを付ける or FIREBASE_SERVICE_ACCOUNT_JSON を使う
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
} else {
  admin.initializeApp();
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

function parseAspect(aspect) {
  if (aspect === "4:5") return { w: 1080, h: 1350 };
  if (aspect === "9:16") return { w: 1080, h: 1920 };
  return { w: 1080, h: 1350 };
}

async function verifyFirebase(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) throw new Error("NO_TOKEN");
  const decoded = await admin.auth().verifyIdToken(m[1]);
  return decoded;
}

async function formatNoCrop(imgBuf, aspect) {
  const { w, h } = parseAspect(aspect);

  const bg = await sharp(imgBuf)
    .resize(w, h, { fit: "cover" })
    .blur(30)
    .jpeg({ quality: 80 })
    .toBuffer();

  const fg = await sharp(imgBuf)
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const out = await sharp(bg)
    .composite([{ input: fg, gravity: "center" }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return out;
}

app.post("/v1/generate", upload.single("image"), async (req, res) => {
  try {
    await verifyFirebase(req);
    const aspect = req.body.aspect || "4:5";
    if (!req.file?.buffer) return res.status(400).json({ error: "NO_IMAGE" });

    // Geminiへ：入力画像 + テキスト（画像編集として“より美味しそうに”）
    const base64 = req.file.buffer.toString("base64");

    const prompt = [
      {
        text:
          "この料理写真をベースに、料理そのものは変えずに、より美味しそうに見える写真を4パターン作ってください。" +
          " 条件: 料理の形や盛り付けは維持、照明改善、ツヤと質感を上げる、背景はうるさくしない、文字やロゴは入れない。写真風でリアル。",
      },
      {
        inlineData: { mimeType: req.file.mimetype || "image/jpeg", data: base64 },
      },
    ];

    const resp = await model.generateContent({
      contents: [{ role: "user", parts: prompt }],
    });

    // 画像Partを拾う（4枚未満なら本番ではリトライ推奨）
    const result = await resp.response;
    const parts = result.candidates?.[0]?.content?.parts || [];
    const images = parts
      .filter((p) => p.inlineData?.data)
      .slice(0, 4)
      .map((p) => Buffer.from(p.inlineData.data, "base64"));

    if (images.length < 4) {
      return res.status(502).json({ error: "NOT_ENOUGH_IMAGES", got: images.length });
    }

    const formatted = [];
    for (const img of images) {
      const out = await formatNoCrop(img, aspect);
      formatted.push({ mime: "image/jpeg", b64: out.toString("base64") });
    }

    res.json({ aspect, count: formatted.length, images: formatted });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg === "NO_TOKEN") return res.status(401).json({ error: "UNAUTHORIZED" });
    console.error(e);
    res.status(500).json({ error: "INTERNAL" });
  }
});

app.get("/health", (_, res) => res.status(200).send("ok"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`listening on ${port}`));
```

#### 環境変数
```bash
GEMINI_API_KEY=...  # Gemini APIキー
FIREBASE_SERVICE_ACCOUNT_JSON='{...}' # 省略可（Cloud Runのサービスアカウント運用なら不要）
```

---

### 7.2 React Native（Expo）側（最小）

#### 依存
```bash
npx expo install expo-image-picker expo-media-library
```

#### 例：画像選択→API→保存（超最小）
```tsx
import React, { useState } from "react";
import { View, Button, Image, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

// Firebase AuthでログインしてIDトークンを取得する想定
async function getIdToken(): Promise<string> {
  // TODO: firebase auth integration
  return "";
}

export default function App() {
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [outs, setOuts] = useState<string[]>([]);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsEditing: false,
    });
    if (!r.canceled) setImgUri(r.assets[0].uri);
  };

  const generate = async () => {
    if (!imgUri) return;

    const token = await getIdToken();
    if (!token) {
      Alert.alert("ログイン未実装", "Firebase AuthのIDトークン取得を実装してください");
      return;
    }

    const form = new FormData();
    form.append("aspect", "4:5");
    form.append("image", {
      uri: imgUri,
      name: "dish.jpg",
      type: "image/jpeg",
    } as any);

    const resp = await fetch("https://YOUR_CLOUD_RUN_URL/v1/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const json = await resp.json();
    if (!resp.ok) {
      Alert.alert("失敗", JSON.stringify(json));
      return;
    }

    // base64 -> data URI
    const dataUris = json.images.map((x: any) => `data:${x.mime};base64,${x.b64}`);
    setOuts(dataUris);
  };

  const saveAll = async () => {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("権限", "写真への保存権限が必要です");
      return;
    }
    for (const uri of outs) {
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("BananaDish", asset, false);
    }
    Alert.alert("保存完了", "4枚保存しました");
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Button title="写真を選ぶ" onPress={pick} />
      <Button title="4枚生成" onPress={generate} />
      <Button title="保存" onPress={saveAll} disabled={outs.length === 0} />

      <ScrollView>
        {imgUri && <Image source={{ uri: imgUri }} style={{ width: "100%", height: 220 }} />}
        {outs.map((u, i) => (
          <Image key={i} source={{ uri: u }} style={{ width: "100%", height: 360, marginTop: 12 }} />
        ))}
      </ScrollView>
    </View>
  );
}
```

> 実運用では base64 の data URI を直接 MediaLibrary に渡すより、
> 一旦 `FileSystem` に保存してから asset 化する方が安定する場合があります（端末差）。

---

## 8. デプロイ（Cloud Runの最短）

### 8.1 Dockerfile
```Dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY server.js ./
EXPOSE 8080
CMD ["npm","start"]
```

### 8.2 gcloud（例）
```bash
gcloud run deploy banana-proxy \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated=false \
  --set-env-vars GEMINI_API_KEY=... \
  --service-account YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com
```

---

## 9. 次の一手（最短でプロダクト化）

1) Firebase Auth（匿名）をRNに組み込み → IDトークンをCloud Runに渡す
2) Cloud Runでレート制限（ユーザーごと：日次/月次）
3) 4枚不足時のリトライ実装（不足分だけ追加生成）
4) base64返却をやめて「Cloud Storage + 署名URL（短期）」に切り替え
5) 課金：Stripe（App Store課金でもOK）

