import { NextRequest, NextResponse } from 'next/server'
import { haversine, estDriveHours, estToll, createSupabaseAdmin } from '@/lib/utils'

const GORA_API = 'https://app.rakuten.co.jp/services/api/GolfonlineGolfCourse/Search/20170519'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat      = parseFloat(searchParams.get('lat') ?? '35.6812')
  const lng      = parseFloat(searchParams.get('lng') ?? '139.7671')
  const hits     = Math.min(parseInt(searchParams.get('hits') ?? '30'), 50)
  const maxHours = searchParams.get('maxHours') ? parseFloat(searchParams.get('maxHours')!) : null
  const price    = searchParams.get('price') ?? 'all' // cheap / mid / prem / all

  // キャッシュチェック
  const supabase = createSupabaseAdmin()
  const cacheKey = `search_${lat.toFixed(3)}_${lng.toFixed(3)}_${hits}`
  const { data: cached } = await supabase
    .from('courses_cache')
    .select('data')
    .eq('id', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()

  let rawCourses: any[]

  if (cached) {
    rawCourses = cached.data
  } else {
    // 楽天GORA API 呼び出し
    const params = new URLSearchParams({
      applicationId: process.env.RAKUTEN_APP_ID!,
      latitude:  lat.toString(),
      longitude: lng.toString(),
      hits:      hits.toString(),
      sort:      '+distance',
      formatVersion: '2',
    })
    try {
      const res = await fetch(`${GORA_API}?${params}`)
      if (!res.ok) throw new Error(`GORA API error: ${res.status}`)
      const json = await res.json()

      rawCourses = (json.Items ?? []).map((item: any) => {
        const c = item
        return {
          id:        String(c.golfCourseId),
          name:      c.golfCourseName,
          addr:      c.address,
          lat:       parseFloat(c.latitude),
          lng:       parseFloat(c.longitude),
          holes:     c.holes ?? 18,
          weekday:   c.weekdayMinPrice ?? 0,
          weekend:   c.holidayMinPrice ?? 0,
          rating:    c.evaluation ?? 0,
          reviews:   c.reviewCount ?? 0,
          imageUrl:  c.golfCourseImageUrl ?? null,
          goraUrl:   c.golfCourseDetailUrl ?? null,
          hp:        c.golfCourseWebsiteUrl ?? null,
          tags:      buildTags(c),
        }
      })

      // キャッシュ保存（TTL 1時間）
      await supabase.from('courses_cache').upsert({
        id: cacheKey,
        data: rawCourses,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    } catch (err) {
      console.error('[courses/search] GORA API失敗', err)
      return NextResponse.json({ error: 'GORA_API_ERROR' }, { status: 502 })
    }
  }

  // 距離・ドライブ時間・高速代を付加
  let courses = rawCourses.map(c => {
    const km     = haversine(lat, lng, c.lat, c.lng)
    const driveH = estDriveHours(km)
    const toll   = estToll(km)
    return { ...c, km, driveH, toll, totalWeekend: c.weekend + toll, totalWeekday: c.weekday + toll }
  }).sort((a, b) => a.km - b.km)

  // フィルター適用
  if (maxHours !== null) {
    courses = courses.filter(c => c.driveH <= maxHours)
  }
  if (price === 'cheap') courses = courses.filter(c => c.weekend > 0 && c.weekend < 10000)
  if (price === 'mid')   courses = courses.filter(c => c.weekend >= 10000 && c.weekend < 15000)
  if (price === 'prem')  courses = courses.filter(c => c.weekend >= 15000)

  return NextResponse.json({ courses, total: courses.length })
}

function buildTags(c: any): string[] {
  const tags: string[] = []
  if (c.holes >= 27) tags.push(`${c.holes}H`)
  if (c.weekdayMinPrice && c.weekdayMinPrice < 8000) tags.push('コスパ◎')
  if (c.evaluation && c.evaluation >= 4.0) tags.push('高評価')
  return tags
}
