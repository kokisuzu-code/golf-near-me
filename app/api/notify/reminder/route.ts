import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyCronSecret } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { user_email, user_name, course_name, days_since_added } = await req.json()

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to:   user_email,
      subject: `⛳ ${course_name}、そろそろ予約しませんか？`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#145A32;">⛳ GOLF NEAR ME</h2>
          <p>${user_name}さん、こんにちは！</p>
          <p>
            行きたいリストに追加してから <strong>${days_since_added}日</strong> が経ちました。<br>
            <strong>「${course_name}」</strong>、まだ予約できていますか？
          </p>
          <p>
            週末の枠はすぐ埋まります。今すぐGORAで空き確認してみましょう！
          </p>
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/wishlist"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#145A32;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
            行きたいリストを見る
          </a>
          <p style="margin-top:24px;font-size:12px;color:#999;">
            このメールはGOLF NEAR MEからお送りしています。<br>
            配信停止は<a href="${process.env.NEXT_PUBLIC_BASE_URL}/unsubscribe">こちら</a>
          </p>
        </div>
      `,
    })

    if (error) throw error
    return NextResponse.json({ success: true, message_id: data?.id })
  } catch (err) {
    console.error('[notify/reminder]', err)
    return NextResponse.json({ error: 'MAIL_ERROR' }, { status: 500 })
  }
}
