// ============================================================
//  CONCREET — STRIPE WEBHOOK
// ============================================================
//  Receives events from Stripe and verifies that they genuinely
//  came from Stripe before acting on them.
//
//  Verification is not optional: this endpoint is publicly
//  reachable, so without a signature check anyone could POST a
//  fake "payment succeeded" event to it.
//
//  Requires STRIPE_WEBHOOK_SECRET (the "whsec_..." value shown
//  when you add the endpoint in the Stripe dashboard). Without
//  it the function refuses every request rather than trusting
//  unverified input.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Reject events older than this, so a captured request cannot be
// replayed later. Stripe's own libraries use the same default.
const TOLERANCE_SECONDS = 300

/** Constant-time hex comparison — a plain === leaks timing information. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Verify Stripe's `Stripe-Signature` header.
 * The header looks like: `t=1690000000,v1=abc...,v1=def...`
 * and the signed payload is `${timestamp}.${rawBody}`.
 */
function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false

  let timestamp = ''
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=')
    if (k === 't') timestamp = v
    else if (k === 'v1' && v) signatures.push(v)
  }
  if (!timestamp || signatures.length === 0) return false

  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return signatures.some((sig) => safeEqualHex(sig, expected))
}

// Dispatch SMS to Owner via Twilio
async function notifyOwnerSms(textMessage: string) {
  const twilioSid = Netlify.env.get('TWILIO_SID')
  const twilioAuthToken = Netlify.env.get('TWILIO_AUTH_TOKEN')
  const ownerPhone = Netlify.env.get('OWNER_PHONE_NUMBER') || '+447494867646'
  const senderId = Netlify.env.get('TWILIO_SENDER_ID') || 'EchoLift'

  if (!twilioSid || !twilioAuthToken) {
    console.log('[stripe-webhook] Twilio environment variables not set. SMS logged:', textMessage)
    return
  }

  try {
    const auth = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64')
    const body = new URLSearchParams({
      To: ownerPhone,
      From: senderId,
      Body: textMessage
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    console.log('[stripe-webhook] Twilio Owner SMS status:', res.status)
  } catch (err) {
    console.error('[stripe-webhook] Twilio Owner SMS error:', err)
  }
}

// Dispatch Email via Resend API
async function sendNotificationEmail(to: string | string[], subject: string, htmlContent: string) {
  const resendApiKey = Netlify.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.log('[stripe-webhook] RESEND_API_KEY not configured. Email logged:', { to, subject })
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Concreet UK <orders@concreet.co.uk>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: htmlContent
      })
    })
    console.log('[stripe-webhook] Email status:', res.status)
  } catch (err) {
    console.error('[stripe-webhook] Email sending error:', err)
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Netlify.env.get('STRIPE_WEBHOOK_SECRET')?.trim()
  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set — refusing to trust this request')
    return new Response('Webhook not configured', { status: 500 })
  }

  const rawBody = await req.text()

  if (!verify(rawBody, req.headers.get('stripe-signature'), secret)) {
    console.warn('stripe-webhook: rejected a request with an invalid signature')
    return new Response('Invalid signature', { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid payload', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data?.object ?? {}
      const customerEmail = s.customer_details?.email || 'Customer'
      const customerName = s.customer_details?.name || 'Customer'
      const amountPaid = s.amount_total ? (s.amount_total / 100).toFixed(2) : '0.00'
      const currency = (s.currency || 'gbp').toUpperCase()
      const basket = s.metadata?.basket || 'Product Order'

      const shipping = s.shipping_details
      const address = shipping?.address ?
        `${shipping.address.line1 || ''}, ${shipping.address.city || ''}, ${shipping.address.postal_code || ''}, ${shipping.address.country || ''}` :
        'Address saved in Stripe'

      console.log('[order] PAID SUCCESS:', { session: s.id, amountPaid, customerEmail, basket })

      // 1. Send SMS Alert to Owner (07494867646)
      const smsNotice = `🎉 [CONCREET SALE ALERT!] New Paid Order!\nAmount: £${amountPaid} ${currency}\nCustomer: ${customerName} (${customerEmail})\nItems: ${basket}\nDelivery: ${address}`
      await notifyOwnerSms(smsNotice)

      // 2. Send Owner Email Alert
      const ownerEmailHtml = `
        <div style="font-family:sans-serif;padding:1.5rem;background:#141414;color:#f4f1eb;border-radius:6px">
          <h2 style="color:#c5a975">🎉 New Paid Order on Concreet.co.uk!</h2>
          <p><strong>Customer Name:</strong> ${customerName}</p>
          <p><strong>Customer Email:</strong> ${customerEmail}</p>
          <p><strong>Amount Paid:</strong> £${amountPaid} ${currency}</p>
          <p><strong>Basket Summary:</strong> ${basket}</p>
          <p><strong>Delivery Address:</strong> ${address}</p>
          <p><strong>Stripe Session ID:</strong> ${s.id}</p>
        </div>
      `
      await sendNotificationEmail(
        ['concreteartisanuk@gmail.com', 'concreteartisanuk@gmail.co.uk'],
        `🎉 NEW CONCREET SALE: £${amountPaid} from ${customerName}`,
        ownerEmailHtml
      )

      // 3. Send Official Concreet Customer Purchase Receipt Email
      const customerReceiptHtml = `
        <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#f4f1eb;padding:2.5rem;border:1px solid #2a2a2a;border-radius:8px">
          <div style="text-align:center;padding-bottom:1.5rem;border-bottom:1px solid #2a2a2a">
            <h1 style="font-family:serif;color:#c5a975;letter-spacing:2px;margin:0;font-size:1.8rem">CONCREET</h1>
            <p style="font-size:0.8rem;color:#8a8578;margin-top:0.3rem;text-transform:uppercase;letter-spacing:1.5px">Handcrafted Architectural Concrete · UK</p>
          </div>

          <div style="padding:1.75rem 0">
            <h2 style="color:#ffffff;font-size:1.35rem;margin-bottom:0.5rem">Thank you for your order, ${customerName}!</h2>
            <p style="color:#d4cfc5;font-size:0.95rem;line-height:1.6">We have received your payment and your order is confirmed. Below is your official purchase receipt.</p>
          </div>

          <div style="background:#141414;border:1px solid #2a2a2a;padding:1.5rem;border-radius:6px;margin-bottom:1.5rem">
            <h3 style="color:#c5a975;font-size:0.95rem;text-transform:uppercase;letter-spacing:1px;margin-top:0;margin-bottom:1rem">Order Summary</h3>
            <p style="margin:0.5rem 0;color:#f4f1eb"><strong>Items Ordered:</strong> ${basket}</p>
            <p style="margin:0.5rem 0;color:#f4f1eb"><strong>Total Amount Paid:</strong> £${amountPaid} ${currency}</p>
            <p style="margin:0.5rem 0;color:#f4f1eb"><strong>Payment Status:</strong> Paid in Full (Secured by Stripe)</p>
            <p style="margin:0.5rem 0;color:#f4f1eb"><strong>Delivery Address:</strong> ${address}</p>
            <p style="margin:0.5rem 0;color:#8a8578;font-size:0.8rem">Reference ID: ${s.id}</p>
          </div>

          <div style="padding-top:1.25rem;border-top:1px solid #2a2a2a;color:#8a8578;font-size:0.85rem;line-height:1.55">
            <p>Every Concreet piece is individually hand-trowelled and sealed in the UK. If you have custom dimension requests or delivery questions, simply reply directly to this email or contact us at <a href="mailto:concreteartisanuk@gmail.com" style="color:#c5a975">concreteartisanuk@gmail.com</a>.</p>
            <p style="margin-top:1rem">&copy; 2026 Concreet. All rights reserved.</p>
          </div>
        </div>
      `
      await sendNotificationEmail(
        customerEmail,
        `Your Concreet Order Receipt & Confirmation`,
        customerReceiptHtml
      )

      break
    }
    case 'checkout.session.expired':
      console.log('[order] abandoned', event.data?.object?.id)
      break
    case 'charge.refunded':
      console.log('[order] refunded', event.data?.object?.id)
      break
    default:
      break
  }

  return Response.json({ received: true })
}

export const config: Config = {
  path: '/.netlify/functions/stripe-webhook',
  method: 'POST',
}
