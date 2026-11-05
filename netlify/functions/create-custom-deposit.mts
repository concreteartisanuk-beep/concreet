import type { Config, Context } from '@netlify/functions'

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions'

function stripeKey(): string | undefined {
  return Netlify.env.get('STRIP_SECRET_KEY') || Netlify.env.get('STRIPE_SECRET_KEY')
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const key = stripeKey()
  if (!key) {
    console.error('create-custom-deposit: no Stripe secret key configured')
    return json({ error: 'Payment gateway configuration missing. Please contact Ian directly at 07494 867646.' }, 500)
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const clientName = String(payload.clientName || 'Bespoke Client').trim()
  const clientEmail = String(payload.clientEmail || '').trim()
  const projectRef = String(payload.projectRef || 'Handcrafted Concrete Furniture').trim()
  const amount = Number(payload.amount)
  const notes = String(payload.notes || '').trim()

  if (!Number.isFinite(amount) || amount < 10 || amount > 10000) {
    return json({ error: 'Deposit amount must be between £10 and £10,000.' }, 400)
  }

  const unitAmountPence = Math.round(amount * 100)

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
  form.set('cancel_url', `${origin}/deposit?client=${encodeURIComponent(clientName)}&ref=${encodeURIComponent(projectRef)}&amount=${amount}`)
  if (clientEmail) {
    form.set('customer_email', clientEmail)
  }
  form.set('billing_address_collection', 'auto')
  form.set('payment_intent_data[statement_descriptor_suffix]', 'CONCREET')

  // Line item
  form.set('line_items[0][quantity]', '1')
  form.set('line_items[0][price_data][currency]', 'gbp')
  form.set('line_items[0][price_data][unit_amount]', String(unitAmountPence))
  form.set('line_items[0][price_data][product_data][name]', `Bespoke Commission Deposit: ${projectRef}`)
  form.set(
    'line_items[0][price_data][product_data][description]',
    `50% production deposit for handcrafted architectural commission for ${clientName}. Handcrafted in County Durham by Concreet.`
  )

  // Metadata
  form.set('metadata[client_name]', clientName)
  form.set('metadata[project_ref]', projectRef)
  form.set('metadata[deposit_amount]', String(amount))
  form.set('metadata[type]', 'bespoke_deposit')
  if (notes) {
    form.set('metadata[notes]', notes.slice(0, 450))
  }

  try {
    const res = await fetch(STRIPE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const body: any = await res.json()
    if (!res.ok) {
      console.error('Stripe error creating custom deposit session:', body)
      return json({ error: body?.error?.message || 'Failed to initialize payment with Stripe.' }, 400)
    }

    return json({ url: body.url, id: body.id })
  } catch (err: any) {
    console.error('Network error contacting Stripe:', err)
    return json({ error: 'Network error connecting to Stripe. Please try again.' }, 500)
  }
}

export const config: Config = {
  path: '/.netlify/functions/create-custom-deposit',
}
