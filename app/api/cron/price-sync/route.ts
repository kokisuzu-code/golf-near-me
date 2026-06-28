import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, verifyCronSecret } from '@/lib/utils'

const GORA_SEARCH_API = 'https://app.rakuten.co.jp/services/api/GolfonlineGolfCourse/Search/20170519'
const BATCH_LIMIT = 100 // タイムアウト対策

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ error: '本番環境のみ実行可能です' }, { status: 403 })
  }
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()

  // 期限切れキャッシュを削除
  await supabase.rpc('clean_expired_cache')

  // 既存キャッシュのコースID一覧を取得（詳細キャッシュのみ対象）
  const { data: cacheEntries } = await supabase
    .from('courses_cache')
    .select('id, cached_at')
    .like('id', 'detail_%')
    .order('cached_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (!cacheEntries || cacheEntries.length === 0) {
    return NextResponse.json({ processed: 0, updated: 0, errors: 0 })
  }

  let updated = 0
  let errors = 0

  for (const entry of cacheEntries) {
    const courseId = entry.id.replace('detail_', '')
    try {
      const params = new URLSearchParams({
        applicationId: process.env.RAKUTEN_APP_ID!,
        golfCourseId:  courseId,
        formatVersion: '2',
      })
      const res = await fetch(`${GORA_SEARCH_API}?${params}`)
      if (!res.ok) { errors++; continue }

      const json = await res.json()
      const c = json.Item
      if (!c) { errors++; continue }

      const course = {
        id:       String(c.golfCourseId),
        name:     c.golfCourseName,
        addr:     c.address,
        lat:      parseFloat(c.latitude),
        lng:      parseFloat(c.longitude),
        holes:    c.holes ?? 18,
        weekday:  c.weekdayMinPrice ?? 0,
        weekend:  c.holidayMinPrice ?? 0,
        rating:   c.evaluation ?? 0,
        reviews:  c.reviewCount ?? 0,
        imageUrl: c.golfCourseImageUrl ?? null,
        goraUrl:  c.golfCourseDetailUrl ?? null,
        hp:       c.golfCourseWebsiteUrl ?? null,
      }

      await supabase.from('courses_cache').upsert({
        id: `detail_${courseId}`,
        data: course,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })

      updated++
      // API レート制限対策
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error('[price-sync] コースID:', courseId, err)
      errors++
    }
  }

  return NextResponse.json({
    processed: cacheEntries.length,
    updated,
    errors,
  })
}
