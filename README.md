# GOLF NEAR ME — セットアップ手順

## 1. 楽天APIキーを取得（5分）

1. https://webservice.rakuten.co.jp/ を開く
2. 楽天アカウントでログイン
3. 「アプリ登録」をクリック
4. アプリ名：`golf-near-me`、URLは仮で `https://example.com` でOK
5. 発行された **applicationId** をメモしておく

---

## 2. Cloudflare アカウント作成（無料）

1. https://cloudflare.com にアクセスして無料登録
2. Workers の無料プランで十分です（10万req/日まで無料）

---

## 3. Wrangler（CLIツール）インストール

```bash
npm install -g wrangler
wrangler login   # ブラウザでCloudflareにログイン
```

---

## 4. APIキーを環境変数として登録

```bash
cd workers/
npx wrangler secret put RAKUTEN_APP_ID
# プロンプトが出たら楽天のapplicationIdを貼り付けてEnter
```

---

## 5. デプロイ

```bash
npx wrangler deploy
```

デプロイ成功すると以下のURLが発行されます：
```
https://golf-near-me-api.あなたの名前.workers.dev
```

---

## 6. フロントのAPIエンドポイントを更新

`golf-finder.html` の先頭付近の `WORKERS_URL` を変更：

```js
// 変更前
const WORKERS_URL = 'https://golf-near-me-api.YOUR_NAME.workers.dev';

// 変更後（実際に発行されたURL）
const WORKERS_URL = 'https://golf-near-me-api.tanaka.workers.dev';
```

---

## 7. 動作確認

ブラウザで直接アクセスして確認：

```
# 東京駅周辺のゴルフ場を30件取得
https://golf-near-me-api.YOUR_NAME.workers.dev/api/courses?lat=35.6812&lng=139.7671&hits=30

# コース詳細（IDは一覧APIで取得したものを使用）
https://golf-near-me-api.YOUR_NAME.workers.dev/api/course?id=70001
```

JSONが返ってきたら成功です。

---

## APIレスポンス例

```json
{
  "courses": [
    {
      "id": "70001",
      "name": "東京よみうりカントリークラブ",
      "addr": "東京都稲城市",
      "lat": 35.629,
      "lng": 139.515,
      "holes": 18,
      "weekday": 8500,
      "weekend": 14000,
      "tags": ["フラット", "都心近郊"],
      "imageUrl": "https://gora.golf.rakuten.co.jp/img/...",
      "hp": "https://www.yomiuri-golf.jp/",
      "goraUrl": "https://gora.golf.rakuten.co.jp/course/detail/?golfCourseId=70001",
      "rating": 4.2,
      "reviews": 312
    }
  ],
  "total": 28
}
```
