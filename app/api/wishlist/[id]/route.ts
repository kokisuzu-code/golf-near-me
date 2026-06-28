import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, createSupabaseAdmin } from '@/lib/utils'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()

  // 対象レコードの存在・所有者確認
  const { data: entry } = await supabase
    .from('wishlist')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  if (entry.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('[wishlist DELETE]', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
