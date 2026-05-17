/**
 * GOLF NEAR ME — Cloudflare Workers API Proxy
 * 楽天GORA API のCORSプロキシ兼データ整形サーバー
 *
 * 環境変数（wrangler secret put で設定）:
 *   RAKUTEN_APP_ID  : 楽天アプリID（applicationId）
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

// 楽天GORA APIのベースURL
const GORA_BASE = 'https://app.rakuten.co.jp/services/api/Gora/GoraGolfCourseSearch/20170623';
const GORA_DETAIL = 'https://app.rakuten.co.jp/services/api/Gora/GoraGolfCourseDetail/20170623';

export default {
  async fetch(request, env) {
    // OPTIONSプリフライト対応
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── /api/courses?lat=xx&lng=xx&hits=30 ──
      // 現在地周辺のゴルフ場一覧を取得
      if (path === '/api/courses') {
        return await handleCourseSearch(url, env);
      }

      // ── /api/course?id=xxxxx ──
      // コース詳細（料金・写真など）を取得
      if (path === '/api/course') {
        return await handleCourseDetail(url, env);
      }

      return jsonError(404, 'Not found');

    } catch (e) {
      return jsonError(500, e.message);
    }
  }
};

// ══════════════════════════════════════════════
// コース一覧取得
// ══════════════════════════════════════════════
async function handleCourseSearch(url, env) {
  const lat  = url.searchParams.get('lat');
  const lng  = url.searchParams.get('lng');
  const hits = url.searchParams.get('hits') || '30';

  if (!lat || !lng) return jsonError(400, 'lat/lng required');

  // 楽天GORA コース検索API
  const params = new URLSearchParams({
    applicationId: env.RAKUTEN_APP_ID,
    format:        'json',
    latitude:      lat,
    longitude:     lng,
    searchRadius:  '100',    // 100km圏内
    hits:          hits,
    page:          '1',
    sort:          'standard',
  });

  const res = await fetch(`${GORA_BASE}?${params}`);
  if (!res.ok) return jsonError(res.status, 'GORA API error');

  const data = await res.json();

  // レスポンスが空
  if (!data.Items || !data.Items.length) {
    return json({ courses: [], total: 0 });
  }

  // データ整形
  const courses = data.Items.map(item => {
    const c = item.Item;
    return normalizeCourse(c);
  // 18H以上の正規コースのみ（ハーフ・ショートコース除外）
  }).filter(c => c.holes >= 18);

  return json({ courses, total: data.count || courses.length });
}

// ══════════════════════════════════════════════
// コース詳細取得（料金・写真）
// ══════════════════════════════════════════════
async function handleCourseDetail(url, env) {
  const id = url.searchParams.get('id');
  if (!id) return jsonError(400, 'id required');

  const params = new URLSearchParams({
    applicationId: env.RAKUTEN_APP_ID,
    format:        'json',
    golfCourseId:  id,
  });

  const res = await fetch(`${GORA_DETAIL}?${params}`);
  if (!res.ok) return jsonError(res.status, 'GORA API error');

  const data = await res.json();
  if (!data.Items || !data.Items.length) return jsonError(404, 'Course not found');

  const c = data.Items[0].Item;
  return json(normalizeCourseDetail(c));
}

// ══════════════════════════════════════════════
// データ整形：一覧用
// ══════════════════════════════════════════════
function normalizeCourse(c) {
  // 18H換算のホール数
  const holes = parseInt(c.holes || '18', 10);

  // 平日・土日の最低グリーンフィーを取得
  // GORAのAPIは weekdayMinPrice / holidayMinPrice を返す
  const weekday = parseInt(c.weekdayMinPrice || c.minPrice || '0', 10);
  const weekend = parseInt(c.holidayMinPrice || c.weekendMinPrice || c.minPrice || '0', 10);

  // タグ生成
  const tags = buildTags(c);

  return {
    id:      c.golfCourseId,
    name:    c.golfCourseName,
    addr:    (c.prefecture || '') + (c.city || ''),
    lat:     parseFloat(c.latitude  || 0),
    lng:     parseFloat(c.longitude || 0),
    holes,
    weekday,
    weekend,
    tags,
    // 写真URL（あれば）
    imageUrl: c.golfCourseImageUrl || c.imageUrl || null,
    // 公式HP
    hp:      c.golfCourseUrl || null,
    // GORA予約URL
    goraUrl: `https://gora.golf.rakuten.co.jp/course/detail/?golfCourseId=${c.golfCourseId}`,
    // 評価
    rating:  parseFloat(c.evaluation || 0),
    reviews: parseInt(c.reviewCount  || 0, 10),
    // 一言メモ
    note:    c.golfCoursePR || '',
  };
}

// ══════════════════════════════════════════════
// データ整形：詳細用（より詳しい料金情報）
// ══════════════════════════════════════════════
function normalizeCourseDetail(c) {
  const base = normalizeCourse(c);
  return {
    ...base,
    // 詳細では平均料金も取れる場合がある
    weekdayAvg: parseInt(c.weekdayAvgPrice || base.weekday, 10),
    weekendAvg: parseInt(c.holidayAvgPrice || base.weekend, 10),
    // コース情報
    courseType: c.courseType || '',
    greenType:  c.greenType  || '',
    designer:   c.designer   || '',
    openYear:   c.openYear   || '',
    // 複数写真
    images: Array.isArray(c.images)
      ? c.images.map(i => i.imageUrl || i).filter(Boolean)
      : (base.imageUrl ? [base.imageUrl] : []),
  };
}

// ══════════════════════════════════════════════
// タグ自動生成
// ══════════════════════════════════════════════
function buildTags(c) {
  const tags = [];
  const name = c.golfCourseName || '';
  const pr   = (c.golfCoursePR  || '').toLowerCase();

  // ホール数
  const holes = parseInt(c.holes || '18', 10);
  if (holes === 27) tags.push('27H');
  if (holes >= 36)  tags.push(holes + 'H');

  // エリア特徴
  if (pr.includes('リゾート') || name.includes('リゾート')) tags.push('リゾート');
  if (pr.includes('海') || pr.includes('ocean'))            tags.push('海眺望');
  if (pr.includes('富士'))                                   tags.push('富士山眺望');
  if (pr.includes('温泉'))                                   tags.push('温泉隣接');
  if (pr.includes('初心者') || pr.includes('beginner'))     tags.push('初心者OK');
  if (pr.includes('フラット') || pr.includes('flat'))       tags.push('フラット');
  if (pr.includes('山') || pr.includes('高原'))             tags.push('山岳');

  // 最大3タグ
  return tags.slice(0, 3);
}

// ══════════════════════════════════════════════
// ユーティリティ
// ══════════════════════════════════════════════
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}
function jsonError(status, message) {
  return json({ error: message }, status);
}
