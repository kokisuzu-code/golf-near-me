import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseAdmin } from '@/lib/utils'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  // ボディはraw textで取得（署名検証のため必須）
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[webhook] 署名検証失敗', err)
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // 冪等性チェック
  const { data: exists } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single()
  if (exists) return NextResponse.json({ received: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await supabase.from('subscriptions').insert({
          user_id: session.metadata?.user_id,
          stripe_subscription_id: sub.id,
          stripe_event_id: event.id,
          status: 'active',
          plan_type: session.metadata?.plan_type,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            stripe_event_id: event.id,
            current_period_end: new Date((invoice as any).period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', invoice.subscription)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due', stripe_event_id: event.id })
          .eq('stripe_subscription_id', invoice.subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', stripe_event_id: event.id })
          .eq('stripe_subscription_id', sub.id)
        break
      }
    }
  } catch (err) {
    console.error('[webhook] DB更新失敗', event.type, err)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
