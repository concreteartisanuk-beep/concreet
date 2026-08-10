// ============================================================
//  CONCREET — SHARED BASKET
// ============================================================
//  One basket, shared by every page and persisted to
//  localStorage. Previously each page kept its own in-memory
//  basket, so moving from the homepage to /shop silently
//  emptied it.
//
//  Only product IDs and quantities are ever stored or sent to
//  the server. Prices come from assets/catalogue.mjs, and the
//  checkout function re-reads them server-side, so a tampered
//  basket cannot change what is charged.
// ============================================================

import { CATALOGUE, FREE_DELIVERY_OVER } from './catalogue.mjs'

const STORAGE_KEY = 'concreet_basket_v1'

/** @type {Record<string, number>} product id -> quantity */
let basket = {}
let lastFocused = null

// ---------- persistence ----------

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    basket = {}
    // Drop anything that is no longer a real product, so a stale
    // basket can never resurrect a discontinued item.
    for (const [id, qty] of Object.entries(parsed)) {
      const n = parseInt(qty, 10)
      if (CATALOGUE[id] && n > 0) basket[id] = Math.min(n, 99)
    }
  } catch {
    basket = {}
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(basket))
  } catch {
    // Private browsing with storage disabled — the basket still
    // works for this page, it just will not survive navigation.
  }
}

// ---------- image helper ----------

/** Route an image through Netlify Image CDN at the size actually displayed. */
export function cdnImg(path, width) {
  if (!path) return ''
  const clean = path.startsWith('/') ? path : '/' + path
  return `/.netlify/images?url=${encodeURIComponent(clean)}&w=${width}&fit=cover`
}

// ---------- basket operations ----------

function addToCart(id) {
  if (!CATALOGUE[id]) {
    console.warn('[basket] unknown product id:', id)
    return
  }
  basket[id] = Math.min((basket[id] || 0) + 1, 99)
  save()
  renderCart()
  openCart()
}

function changeQty(id, delta) {
  if (!basket[id]) return
  basket[id] += delta
  if (basket[id] < 1) delete basket[id]
  save()
  renderCart()
}

function removeItem(id) {
  delete basket[id]
  save()
  renderCart()
}

function totals() {
  let count = 0
  let total = 0
  for (const [id, qty] of Object.entries(basket)) {
    const p = CATALOGUE[id]
    if (!p) continue
    count += qty
    total += p.price * qty
  }
  return { count, total }
}

// ---------- rendering ----------

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

function renderCart() {
  const { count, total } = totals()

  const countEl = document.getElementById('cart-count')
  if (countEl) {
    countEl.textContent = String(count)
    countEl.style.display = count > 0 ? 'inline' : 'none'
  }

  const totalEl = document.getElementById('cart-total')
  if (totalEl) totalEl.textContent = '£' + total.toFixed(2)

  const btn = document.getElementById('btn-stripe')
  if (btn) btn.disabled = count === 0

  const noteEl = document.getElementById('cart-delivery-note')
  if (noteEl) {
    const remaining = FREE_DELIVERY_OVER - total
    noteEl.textContent =
      count === 0
        ? ''
        : remaining > 0
          ? `Spend £${remaining.toFixed(2)} more for free UK delivery`
          : '✓ Your order qualifies for free UK delivery'
  }

  const el = document.getElementById('cart-items')
  if (!el) return

  const ids = Object.keys(basket)
  if (ids.length === 0) {
    el.innerHTML = '<div class="cart-empty">Your basket is empty</div>'
    return
  }

  el.innerHTML = ids
    .map((id) => {
      const p = CATALOGUE[id]
      const qty = basket[id]
      const name = escapeHtml(p.name)
      return (
        '<div class="cart-item">' +
        `<img src="${cdnImg(p.image, 128)}" alt="" width="64" height="64" loading="lazy">` +
        `<div><div class="cart-item-name">${name}</div>` +
        `<div class="cart-item-price">£${(p.price * qty).toFixed(2)}</div></div>` +
        '<div class="qty-ctrl">' +
        `<button class="qty-btn" data-qty="-1" data-id="${id}" aria-label="Reduce quantity of ${name}">−</button>` +
        `<span class="qty-num" aria-label="Quantity">${qty}</span>` +
        `<button class="qty-btn" data-qty="1" data-id="${id}" aria-label="Increase quantity of ${name}">+</button>` +
        '</div></div>'
      )
    })
    .join('')
}

// ---------- drawer (with focus management) ----------

function focusable(root) {
  return [...root.querySelectorAll('button, [href], input, select, textarea')].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  )
}

function openCart() {
  const drawer = document.getElementById('cart-drawer')
  const overlay = document.getElementById('cart-overlay')
  if (!drawer) return
  lastFocused = document.activeElement
  drawer.classList.add('open')
  drawer.removeAttribute('aria-hidden')
  if (overlay) overlay.classList.add('open')
  document.body.style.overflow = 'hidden'
  const first = focusable(drawer)[0]
  if (first) first.focus()
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer')
  const overlay = document.getElementById('cart-overlay')
  if (!drawer) return
  drawer.classList.remove('open')
  drawer.setAttribute('aria-hidden', 'true')
  if (overlay) overlay.classList.remove('open')
  document.body.style.overflow = ''
  if (lastFocused && lastFocused.focus) lastFocused.focus()
  lastFocused = null
}

function isOpen() {
  const drawer = document.getElementById('cart-drawer')
  return drawer && drawer.classList.contains('open')
}

function toggleMenu() {
  const menu = document.getElementById('mobile-menu')
  const burger = document.getElementById('hamburger')
  if (!menu) return
  const open = menu.classList.toggle('open')
  if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false')
}

// ---------- checkout ----------

async function goToStripe() {
  const items = Object.entries(basket).map(([id, quantity]) => ({ id, quantity }))
  if (items.length === 0) return

  const btn = document.getElementById('btn-stripe')
  const original = btn ? btn.textContent : ''
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Redirecting to Stripe…'
  }

  try {
    // Only IDs and quantities go over the wire. The function
    // prices the order from the server-side catalogue.
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json().catch(() => ({}))

    if (res.ok && data.url) {
      window.location.href = data.url
      return
    }
    alert('Payment error: ' + (data.error || 'We could not start checkout. Please try again.'))
  } catch {
    alert('Could not connect to the payment gateway. Please try again.')
  }

  if (btn) {
    btn.disabled = false
    btn.textContent = original
  }
}

/** Clear the basket — called by the order confirmation page. */
function clearCart() {
  basket = {}
  save()
  renderCart()
}

// ---------- wiring ----------

function init() {
  load()
  renderCart()

  // Quantity buttons are delegated so re-rendering the list
  // never leaves stale handlers behind.
  const items = document.getElementById('cart-items')
  if (items) {
    items.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-qty]')
      if (!btn) return
      changeQty(btn.dataset.id, parseInt(btn.dataset.qty, 10))
    })
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isOpen()) closeCart()
      const menu = document.getElementById('mobile-menu')
      if (menu && menu.classList.contains('open')) toggleMenu()
    }
    // Keep tabbing inside the drawer while it is open.
    if (e.key === 'Tab' && isOpen()) {
      const drawer = document.getElementById('cart-drawer')
      const f = focusable(drawer)
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  // Another tab changed the basket — stay in step.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      load()
      renderCart()
    }
  })

  const drawer = document.getElementById('cart-drawer')
  if (drawer && !drawer.classList.contains('open')) {
    drawer.setAttribute('aria-hidden', 'true')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Exposed globally because the product cards use inline onclick
// attributes. addToCart tolerates the old four-argument calls
// (name/price/image) and ignores everything after the id.
Object.assign(window, {
  addToCart,
  changeQty,
  removeItem,
  openCart,
  closeCart,
  toggleMenu,
  goToStripe,
  clearCart,
  cdnImg,
  CONCREET_CATALOGUE: CATALOGUE,
})
