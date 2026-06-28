import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUserFromRequest } from '@/lib/utils'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, string> = {
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY!,
  premium_annual:  process.env.STRIPE_PRICE_PREMIUM_ANNUAL!,
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { plan_type } = await req.json()
  const priceId = PRICE_IDS[plan_type]
  if (!priceId) {
    return NextResponse.json({ error: 'INVALID_PLAN_TYPE' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?checkout=success`,
      cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
      metadata: { user_id: user.id, plan_type },
      subscription_data: { metadata: { user_id: user.id } },
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: 'STRIPE_ERROR' }, { status: 500 })
  }
}
