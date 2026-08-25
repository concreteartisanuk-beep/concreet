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

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Netlify.env.get('STRIPE_WEBHOOK_SECRET')?.trim()
  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET is not set — refusing to trust this request')
    return new Response('Webhook not configured', { status: 500 })
  }

  // Must be the raw body, byte for byte. Parsing and re-serialising
  // JSON changes whitespace and breaks the signature.
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
      console.log('[order] paid', {
        session: s.id,
        amount: s.amount_total,
        currency: s.currency,
        email: s.customer_details?.email,
        basket: s.metadata?.basket,
      })
      break
    }
    case 'checkout.session.expired':
      console.log('[order] abandoned', event.data?.object?.id)
      break
    case 'charge.refunded':
      console.log('[order] refunded', event.data?.object?.id)
      break
    default:
      // Unhandled event types still get a 200 — Stripe retries
      // anything else, which would fill the logs with noise.
      break
  }

  return Response.json({ received: true })
}

export const config: Config = {
  path: '/.netlify/functions/stripe-webhook',
  method: 'POST',
}
