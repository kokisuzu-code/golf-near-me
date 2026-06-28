export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ color: '#2d6a4f', fontSize: 32 }}>⛳ 近くのゴルフ場を探す</h1>
      <p style={{ color: '#555', marginBottom: 32 }}>現在地周辺のゴルフ場をAIがおすすめします</p>

      <section style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ color: '#1b4332', marginTop: 0 }}>🔍 ゴルフ場を検索</h2>
        <form action="/api/courses/search" method="GET" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input name="lat" placeholder="緯度 例: 35.6895" style={inputStyle} />
          <input name="lng" placeholder="経度 例: 139.6917" style={inputStyle} />
          <input name="radius" placeholder="半径(km) 例: 50" style={{ ...inputStyle, width: 120 }} />
          <button type="submit" style={btnStyle}>検索</button>
        </form>
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ color: '#1b4332', marginTop: 0 }}>🤖 AIおすすめ</h2>
        <p style={{ color: '#666' }}>APIエンドポイント: <code>/api/ai/recommend</code></p>
        <ul style={{ color: '#555', lineHeight: 2 }}>
          <li><code>POST /api/courses/search</code> — ゴルフ場検索</li>
          <li><code>POST /api/ai/recommend</code> — AIレコメンド</li>
          <li><code>GET /api/wishlist</code> — ウィッシュリスト取得</li>
          <li><code>POST /api/wishlist</code> — ウィッシュリスト追加</li>
          <li><code>POST /api/notify/reminder</code> — リマインダー送信</li>
        </ul>
      </section>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #ccc',
  fontSize: 14,
  flex: 1,
  minWidth: 160,
}

const btnStyle: React.CSSProperties = {
  padding: '10px 24px',
  background: '#2d6a4f',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
}
