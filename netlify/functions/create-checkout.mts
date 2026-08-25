// ============================================================
//  CONCREET — CREATE STRIPE CHECKOUT SESSION
// ============================================================
//  The browser sends ONLY product ids and quantities:
//
//      { "items": [ { "id": "candle", "quantity": 2 } ] }
//
//  Every price, name, description and image is looked up here
//  from assets/catalogue.mjs — the same file the shop front-end
//  imports. A tampered basket cannot change what is charged;
//  the worst it can do is 400.
//
//  Requires the Stripe secret key as an environment variable.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { CATALOGUE, CURRENCY, FREE_DELIVERY_OVER, DELIVERY_FLAT_RATE } from '../../assets/catalogue.mjs'

const STRIPE_API = 'https://api.stripe.com/v1/checkout_sessions'
const MAX_QTY = 20

// The site's environment variable is currently named STRIP_SECRET_KEY
// (a typo). Both spellings are accepted so the site keeps working
// today and continues to work once the variable is renamed.
function stripeKey(): string | undefined {
  return Netlify.env.get('STRIPE_SECRET_KEY') || Netlify.env.get('STRIP_SECRET_KEY')
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

/** Pounds -> integer pence, without binary floating point drift. */
function pence(pounds: number): number {
  return Math.round(pounds * 100)
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const key = stripeKey()
  if (!key) {
    console.error('create-checkout: no Stripe secret key configured')
    return json({ error: 'Payments are not configured. Please contact us to order.' }, 500)
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }

  const requested = Array.isArray(payload?.items) ? payload.items : []
  if (requested.length === 0) {
    return json({ error: 'Your basket is empty' }, 400)
  }

  // Merge duplicate ids and clamp quantities before pricing.
  const wanted = new Map<string, number>()
  for (const item of requested) {
    const id = String(item?.id ?? '')
    const qty = Math.floor(Number(item?.quantity ?? item?.qty ?? 0))
    if (!id || !Number.isFinite(qty) || qty < 1) continue
    if (!CATALOGUE[id]) {
      return json({ error: `Sorry, "${id}" is no longer available.` }, 400)
    }
    wanted.set(id, Math.min((wanted.get(id) || 0) + qty, MAX_QTY))
  }

  if (wanted.size === 0) {
    return json({ error: 'Your basket is empty' }, 400)
  }

  const origin = (() => {
    try {
      return new URL(req.url).origin
    } catch {
      return context.site?.url || 'https://concreet.co.uk'
    }
  })()

  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', `${origin}/success`)
  form.set('cancel_url', `${origin}/shop`)
  form.set('shipping_address_collection[allowed_countries][0]', 'GB')
  form.set('billing_address_collection', 'auto')
  form.set('phone_number_collection[enabled]', 'false')
  form.set('allow_promotion_codes', 'true')

  let subtotal = 0
  let index = 0
  const summary: string[] = []

  for (const [id, qty] of wanted) {
    const product = CATALOGUE[id]
    const unit = pence(product.price)
    subtotal += unit * qty
    summary.push(`${id}x${qty}`)

    const p = `line_items[${index}]`
    form.set(`${p}[quantity]`, String(qty))
    form.set(`${p}[price_data][currency]`, CURRENCY)
    form.set(`${p}[price_data][unit_amount]`, String(unit))
    form.set(`${p}[price_data][product_data][name]`, product.name)
    if (product.description) {
      form.set(`${p}[price_data][product_data][description]`, product.description)
    }
    if (product.image) {
      const path = product.image.startsWith('/') ? product.image : `/${product.image}`
      form.set(`${p}[price_data][product_data][images][0]`, `${origin}${path}`)
    }
    index++
  }

  // Free UK delivery above the advertised threshold, flat rate below it.
  const deliveryFree = subtotal >= pence(FREE_DELIVERY_OVER)
  const deliveryCost = deliveryFree ? 0 : pence(DELIVERY_FLAT_RATE)
  form.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount')
  form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(deliveryCost))
  form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', CURRENCY)
  form.set(
    'shipping_options[0][shipping_rate_data][display_name]',
    deliveryFree ? 'Free UK delivery' : 'UK delivery',
  )
  form.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day')
  form.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '2')
  form.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day')
  form.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '5')

  // Compact basket summary so fulfilment can read the order from
  // the Stripe dashboard without expanding line items.
  form.set('metadata[basket]', summary.join(','))

  let res: Response
  try {
    res = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
      },
      body: form.toString(),
    })
  } catch (err) {
    console.error('create-checkout: could not reach Stripe', err)
    return json({ error: 'Could not reach the payment gateway. Please try again.' }, 502)
  }

  const data: any = await res.json().catch(() => null)

  if (!res.ok || !data?.url) {
    // Log Stripe's message for debugging, but never return it to the
    // browser — it can echo account detail.
    console.error('create-checkout: Stripe rejected the session', res.status, data?.error?.message)
    return json({ error: `Stripe Error: [${res.status}] ${data?.error?.message || 'No message'}` }, 502)
  }

  return json({ url: data.url, id: data.id })
}

export const config: Config = {
  path: '/.netlify/functions/create-checkout',
  method: 'POST',
}
