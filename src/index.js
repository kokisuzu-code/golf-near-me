const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const SEARCH = 'https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623';
const PLAN   = 'https://openapi.rakuten.co.jp/engine/api/Gora/GoraPlanSearch/20170623';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url  = new URL(request.url);
    const path = url.pathname;

    // コース一覧（料金なし・高速）
    if (path === '/api/courses') {
      const lat  = url.searchParams.get('lat');
      const lng  = url.searchParams.get('lng');
      const hits = Math.min(parseInt(url.searchParams.get('hits') || '30'), 30);
      if (!lat || !lng) return err(400, 'lat/lng required');

      const sp = new URLSearchParams({
        applicationId: env.RAKUTEN_APP_ID,
        accessKey:     env.RAKUTEN_ACCESS_KEY,
        format: 'json', latitude: lat, longitude: lng,
        searchRadius: '100', hits: String(hits), page: '1',
      });
      const sr = await fetch(`${SEARCH}?${sp}`);
      if (!sr.ok) return err(sr.status, 'search error');
      const sd = await sr.json();
      if (!sd.Items?.length) return json({ courses: [], total: 0 });

      const courses = sd.Items.map(item => {
        const c = item.Item;
        return {
          id: c.golfCourseId, name: c.golfCourseName,
          addr: c.address || '',
          lat: parseFloat(c.latitude || 0), lng: parseFloat(c.longitude || 0),
          holes: parseInt(c.holes || '18', 10) || 18,
          weekday: 0, weekend: 0,
          tags: buildTags(c),
          imageUrl: c.golfCourseImageUrl || null,
          hp: c.golfCourseDetailUrl || null,
          goraUrl: c.reserveCalUrl || c.golfCourseDetailUrl || null,
          rating: parseFloat(c.evaluation || 0),
          note: (c.highway || '') + (c.ic ? ' ' + c.ic : ''),
        };
      }).filter(c => c.holes >= 18);

      return json({ courses, total: sd.count || courses.length });
    }

    // 料金取得（1コースずつ）
    if (path === '/api/price') {
      const id = url.searchParams.get('id');
      if (!id) return err(400, 'id required');

      const weekdays = nextDates(false, 8);
      const weekends = nextDates(true,  8);

      let weekday = 0, weekend = 0;

      for (const date of weekdays) {
        const r = await fetch(`${PLAN}?${planParams(env, id, date)}`);
        if (r.ok) { const p = extractPrice(await r.json()); if (p > 0) { weekday = p; break; } }
      }
      for (const date of weekends) {
        const r = await fetch(`${PLAN}?${planParams(env, id, date)}`);
        if (r.ok) { const p = extractPrice(await r.json()); if (p > 0) { weekend = p; break; } }
      }

      return json({ id: parseInt(id), weekday, weekend });
    }

    return err(404, 'not found');
  }
};

function nextDates(isWeekend, count) {
  const dates = []; const d = new Date(); d.setDate(d.getDate() + 1);
  while (dates.length < count) {
    const dow = d.getDay(); const isWE = dow === 0 || dow === 6;
    if (isWeekend === isWE) dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
function planParams(env, courseId, playDate) {
  return new URLSearchParams({
    applicationId: env.RAKUTEN_APP_ID, accessKey: env.RAKUTEN_ACCESS_KEY,
    format: 'json', golfCourseId: courseId, playDate, hits: '3',
  });
}
function extractPrice(data) {
  if (!data.Items?.length) return 0;
  const item = data.Items[0].Item;
  if (item.planInfo?.length) {
    const lunchPlans = item.planInfo
      .filter(p => p.plan && p.plan.lunch === 1)
      .map(p => parseInt(p.plan.basePrice || 0))
      .filter(p => p > 0);
    if (lunchPlans.length) return Math.min(...lunchPlans);
    const allPrices = item.planInfo
      .map(p => parseInt(p.plan && p.plan.basePrice || 0))
      .filter(p => p > 0)
      .sort((a,b)=>a-b);
    if (allPrices.length) return allPrices[Math.floor(allPrices.length/2)];
  }
  return 0;
}
function buildTags(c) {
  const tags = []; const pr = (c.golfCourseCaption || '').toLowerCase();
  const holes = parseInt(c.holes || '18', 10);
  if (holes === 27) tags.push('27H'); if (holes >= 36) tags.push(holes + 'H');
  if (pr.includes('リゾート')) tags.push('リゾート');
  if (pr.includes('海')) tags.push('海眺望');
  if (pr.includes('富士')) tags.push('富士山眺望');
  if (pr.includes('温泉')) tags.push('温泉隣接');
  if (pr.includes('初心者')) tags.push('初心者OK');
  if (pr.includes('フラット')) tags.push('フラット');
  return tags.slice(0, 3);
}
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS }); }
function err(status, msg) { return new Response(JSON.stringify({ error: msg }), { status, headers: CORS }); }
