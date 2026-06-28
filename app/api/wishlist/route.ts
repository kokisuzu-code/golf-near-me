import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, createSupabaseAdmin } from '@/lib/utils'

// GET - 行きたいリスト取得
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('wishlist')
    .select('id, course_id, course_name, course_data, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (error) {
    console.error('[wishlist GET]', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ wishlist: data })
}

// POST - コース追加
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { course_id, course_name, course_data } = await req.json()
  if (!course_id || !course_name) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('wishlist')
    .insert({ user_id: user.id, course_id, course_name, course_data })
    .select('id')
    .single()

  if (error) {
    // unique制約違反 = 重複登録
    if (error.code === '23505') {
      return NextResponse.json({ error: 'ALREADY_IN_WISHLIST' }, { status: 409 })
    }
    console.error('[wishlist POST]', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
