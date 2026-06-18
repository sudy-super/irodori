# irodori

「いろ」でつながる色覚支援ツール。色覚異常 (1型 / 2型 / 3型) や黄斑変性で色の見え方が異なる人と、正常色覚を持つ人を「描く・見せ合う」体験でつなぐ Web サービス。

- お題に合わせて自分の見え方で絵を描く
- ギャラリーで誰かの絵を「相手の見え方」で鑑賞する (5x5 全色覚タイプの組み合わせを切替可能)
- D-15 ヒューテストで自分の色覚タイプを診断する

## 構成

~~~
irodori/
├── ref/      参考資料 (PDF / thumbnail / 既存 D15.html)
├── web/      フロントエンド (Vite + React + TypeScript)
└── worker/   バックエンド (Cloudflare Workers + Hono + D1 + R2)
~~~

## 必要要件

- Node.js 20+ (確認: `node -v`)
- npm 10+ (workspaces 使用)
- Cloudflare アカウント (本番デプロイ時、無料プラン OK)
- (任意) Adobe Fonts の Web Kit ID — 持っていなければフォールバックフォントで動作

## はじめかた

~~~bash
# 依存をインストール
npm install

# フロントエンド開発サーバ (http://localhost:5173)
npm run dev:web

# 別ターミナルで Worker をローカル起動 (http://localhost:8787)
# 事前に D1 を初期化する必要があります (後述)
npm run dev:worker
~~~

Vite 開発サーバは `/api/*` と `/images/*` を Worker (8787) にプロキシするので、フロントから普通に fetch するだけで通信できます。

## 自分の環境にデプロイする (fork / clone した人向け)

API・画像配信・フロントエンドすべてを **一つの Cloudflare Worker** で配信します
(`[assets]` の Static Assets 機能で `web/dist` を同居)。同一オリジンになるため
CORS や `PUBLIC_BASE`、`VITE_API_BASE` の設定は不要です。

### 0. 前提

- Cloudflare の無料プランで OK
- Node.js 20+ / npm 10+
- `npx wrangler login` 済み (ブラウザで Cloudflare の OAuth を 1 度通す)

### 1. 自動セットアップ (推奨)

D1 作成 → R2 作成 → `wrangler.toml` の `database_id` 自動書き換え →
本番 D1 にスキーマ適用までを 1 コマンドで実行します。

~~~bash
npm install
./scripts/setup-cloudflare.sh
~~~

D1 / R2 の名前を変えたい場合は環境変数で渡せます:

~~~bash
DB_NAME=my-irodori BUCKET_NAME=my-irodori-images ./scripts/setup-cloudflare.sh
~~~

#### 手動でやりたい場合 (自動セットアップを使わない場合)

~~~bash
cd worker

# D1 データベースを作成
npx wrangler d1 create irodori
# → 出力された database_id を worker/wrangler.toml の
#   `REPLACE_WITH_YOUR_D1_DATABASE_ID` 部分に貼り付け

# R2 バケットを作成
npx wrangler r2 bucket create irodori-images

# 本番 D1 にスキーマ適用
cd .. && npm run db:apply:remote
~~~

### 2. デプロイ

~~~bash
npm run deploy
~~~

初回デプロイ後、Cloudflare ダッシュボードの Workers にこの Worker が登場し、
`https://<your-worker-name>.<your-subdomain>.workers.dev` でアクセス可能になります。

### 3. (任意) 独自ドメインで配信したい

`worker/wrangler.toml` 末尾の `routes = [...]` のコメントを外し、Cloudflare の
同アカウントに登録済みドメインを指定してから再度 `npm run deploy`:

~~~toml
routes = [
  { pattern = "irodori.example.com", custom_domain = true }
]
~~~

`custom_domain = true` にしておけば DNS レコードと SSL 証明書を Cloudflare が自動でプロビジョンします。

### 4. (任意) サンプル絵をシード投稿する

`scripts/seed.mjs` が 16 枚のサンプル絵を生成して投稿します:

~~~bash
# 本番に直接シード
API_BASE=https://<your-worker-name>.<your-subdomain>.workers.dev npm run seed

# 独自ドメインを設定済みなら
API_BASE=https://irodori.example.com npm run seed
~~~

ローカル開発時は `npm run dev:worker` を別ターミナルで起動した状態で、
`API_BASE` を省略すれば `http://localhost:8787` へ投稿されます。

### Adobe Fonts (任意)

タイトル「irodori」は Adobe Fonts の `AB-J-GU` を Web フォントとして読み込みます。
Kit を持っていない場合はフォールバックフォントで表示されるだけで、サービス自体は動きます。
使いたい場合のみ:

~~~bash
echo "VITE_TYPEKIT_ID=xxxxxxx" > web/.env.local
~~~

## D-15 色覚診断

`ref/D15.html` (Colorlite) のロジックを `web/src/lib/d15.ts` に TypeScript で移植。基準キャップ + 並べ替え対象 15 色を提示し、隣接ペアの色相環ジャンプを軸別 (Protan / Deutan / Tritan) に集計して診断します。

## 色覚シミュレーション

`web/src/lib/colorMatrices.ts` で Machado et al. (2009) の RGB 変換行列を実装。`web/src/components/ColorFilterDefs.tsx` が SVG `<defs>` にすべての (type x severity) 組み合わせの `feColorMatrix` フィルタを定義し、`filter: url(#vision-protan-100)` のように要素単位で適用します。

これにより、投稿者と鑑賞者の色覚タイプのあらゆる組み合わせ (5 x 5 = 25 通り) を同じ実装で再現できます。

## 主要ファイル

- `web/src/routes/Home.tsx` — トップ画面
- `web/src/routes/Diagnose.tsx` — D-15 色覚診断
- `web/src/routes/Draw.tsx` — 描画 + 投稿
- `web/src/routes/Gallery.tsx` — 一覧 + 検索
- `web/src/routes/Post.tsx` — 個別表示 + 鑑賞モード切替
- `web/src/components/D15SortBoard.tsx` — D-15 並び替え UI
- `web/src/components/DrawingCanvas.tsx` — 描画 Canvas
- `web/src/components/ColorPalette.tsx` — 10色パレット
- `web/src/components/ColorFilterDefs.tsx` — SVG フィルタ定義
- `web/src/components/VisionToggle.tsx` — 鑑賞モード切替
- `web/src/lib/d15.ts` — D-15 判定ロジック
- `web/src/lib/colorMatrices.ts` — 色覚変換行列
- `worker/src/index.ts` — API
- `worker/schema.sql` — D1 スキーマ
