import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// ── Supabase サーバークライアント（JWT認証あり）──
export function createSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name, value, options) { cookieStore.set({ name, value, ...options }) },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}

// ── Supabase サービスロールクライアント（RLSバイパス）──
export function createSupabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── JWTからユーザー取得 ──
export async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// ── プレミアム会員チェック ──
export async function isPremiumUser(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  return !!data
}

// ── Haversine距離計算（km）──
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── ドライブ時間推定（時間）──
export function estDriveHours(km: number): number {
  const factor = km < 50 ? 1.8 : km < 100 ? 1.55 : km < 200 ? 1.45 : 1.4
  return (km * factor / 80) + (Math.min(30, km * 0.15) / 60)
}

// ── 高速代推定（往復・ETC）──
export function estToll(km: number): number {
  const hwKm = km < 20 ? 0 : km < 50 ? km * 0.85 : km < 100 ? km * 0.9 : km * 0.92
  if (hwKm <= 0) return 0
  let oneway = hwKm * 46
  if (km < 150) oneway += 400
  if (hwKm > 200) oneway *= 0.88
  else if (hwKm > 100) oneway *= 0.94
  return Math.ceil((oneway * 2) / 100) * 100
}

// ── 料金ティア判定 ──
export function priceTier(price: number): 'cheap' | 'mid' | 'prem' {
  if (price < 10000) return 'cheap'
  if (price < 15000) return 'mid'
  return 'prem'
}

// ── CRON_SECRET認証 ──
export function verifyCronSecret(req: NextRequest): boolean {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  return token === process.env.CRON_SECRET
}
