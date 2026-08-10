// ============================================================
//  CONCREET — CANONICAL PRODUCT CATALOGUE
// ============================================================
//  This file is the single source of truth for product IDs,
//  names and prices. It is imported by BOTH:
//
//    * the browser (assets/cart.js) — to render the basket
//    * netlify/functions/create-checkout.mts — to price the order
//
//  The checkout function NEVER trusts a price sent by the
//  browser. It looks every price up here, server-side. That
//  means editing a price in this one file changes what the
//  customer is charged — there is nowhere else to update.
//
//  Prices are in pounds sterling (GBP).
// ============================================================

export const CURRENCY = 'gbp'

export const CATALOGUE = {
  // ---- Candles & homeware (homepage) ----
  'sml-candle': {
    name: 'Small Volcanic Concrete Candle',
    price: 13.99,
    image: 'images/concrete-candle-artisan.jpg',
    description: 'Hand-poured plant-based wax in a raw, reusable concrete vessel.',
  },
  'nat-candle': {
    name: 'Handmade Natural Concrete Candle',
    price: 19.99,
    image: 'images/concrete-candle-natural.png',
    description: 'Signature natural concrete candle with a subtle natural fragrance.',
  },
  'vol-candle': {
    name: 'Volcanic Concrete Candle',
    price: 19.99,
    image: 'images/concrete-candle-lifestyle.png',
    description: 'Large volcanic concrete candle with a long burn time and natural scent.',
  },
  holder: {
    name: 'Concrete Candle Holder',
    price: 19.99,
    image: 'images/candle.png',
    description: 'Hand-cast concrete candle holder, minimalist and beautifully weighted.',
  },
  soap: {
    name: 'Concrete Soap Bar',
    price: 9.99,
    image: 'images/concrete-soap-botanical.png',
    description: 'Cold-pressed with natural oils. No sulphates, no parabens.',
  },
  lipbalm10: {
    name: 'Concrete Kiss Lip Balm 10ml',
    price: 7.99,
    image: 'images/concrete-lipbalm-lifestyle.png',
    description: 'Beeswax, shea butter and natural botanicals in a 10ml concrete tin.',
  },
  lipbalm14: {
    name: 'Concrete Kiss Lip Balm 14ml',
    price: 10.99,
    image: 'images/lip-balm.png',
    description: 'Beeswax, shea butter and natural botanicals in a 14ml concrete tin.',
  },
  diffuser: {
    name: 'Reed Diffuser',
    price: 24.99,
    image: 'images/concrete-diffuser-lifestyle.png',
    description: 'Hand-cast concrete diffuser with natural reeds. Lasts up to 3 months.',
  },

  // ---- Shop page ----
  candle: {
    name: 'The Concrete Candle',
    price: 18.99,
    image: 'images/concrete-candle-artisan.jpg',
    description: 'Hand-poured soy wax in a real concrete vessel. 40+ hour burn time.',
  },
  lipbalm: {
    name: 'Botanical Lip Balm',
    price: 7.99,
    image: 'images/lip-balm.jpg',
    description: 'Beeswax, shea butter and natural botanicals in a concrete tin.',
  },
  'diffuser-volcanic': {
    name: 'Concrete Diffuser with Volcanic Rocks',
    price: 29.99,
    image: 'images/diffuser-volcanic.jpg',
    description: 'Concrete vessel filled with volcanic rocks that slowly release fragrance.',
  },
  bundle: {
    name: 'The Complete Concreet Gift Set',
    price: 54.99,
    image: 'images/gift-set.png',
    description: 'Candle, soap, lip balm and diffuser in a beautiful concrete gift box.',
  },

  // ---- Homeware (furniture page) ----
  'clock-copper': {
    name: 'Concrete Wall Clock — Copper',
    price: 69.99,
    image: 'images/clock-copper.jpg',
    description: 'Recessed hour markers and brushed copper hands. 30cm. Silent sweep movement.',
  },
  'clock-wood': {
    name: 'Concrete Wall Clock — Oak',
    price: 69.99,
    image: 'images/clock-wood.jpg',
    description: 'Recessed hour markers and natural oak hands. 30cm. Silent sweep movement.',
  },
  'bowl-grey': {
    name: 'Decorative Bowl — Grey',
    price: 34.99,
    image: 'images/bowl-grey.jpg',
    description: 'A small grey key dish, approx. 15cm across, with a smooth hand-finished interior.',
  },
  'bowl-large': {
    name: 'Display Bowl — Cream',
    price: 44.99,
    image: 'images/bowl-display.jpg',
    description: 'Wide, shallow cream bowl, approx. 22cm across. Raw outside, polished inside.',
  },
  planter: {
    name: 'Faceted Planter — Charcoal',
    price: 29.99,
    image: 'images/planter-geo.jpg',
    description: 'Sharply faceted near-black planter, approx. 16cm across. Drainage hole included.',
  },
  'bowl-deep': {
    name: 'Deep Set Bowl',
    price: 39.99,
    image: 'images/bowl-set.jpg',
    description: 'A taller concrete bowl, approx. 20cm across and 11cm deep. Works as a fruit bowl.',
  },
  'planter-hex': {
    name: 'Hexagonal Planter',
    price: 49.0,
    image: 'images/hexagonal-concrete-planter-geometric.jpg',
    description: 'Faceted pale grey vessel, approx. 18cm across. No drainage hole — safe on furniture.',
  },

  // ---- Made-to-order furniture ----
  // Lead time 4–6 weeks; delivered and positioned rather than couriered.
  'coffee-block-float': {
    name: 'The Floating Block Coffee Table',
    price: 895.0,
    image: 'images/concrete-block-coffee-table-floating.jpg',
    description: 'Deep storm-grey block on a recessed plinth. 120×80×38cm as shown. Made to order.',
  },
  'coffee-rect': {
    name: 'The Low Slab Coffee Table',
    price: 449.0,
    image: 'images/concrete-coffee-table-candle-styling.jpg',
    description: 'Low pale-grey slab on a recessed plinth. 110×60×25cm as shown. Made to order.',
  },
  'coffee-grand-sq': {
    name: 'The Grand Square Coffee Table',
    price: 895.0,
    image: 'images/large-concrete-coffee-table-luxury-room.jpg',
    description: 'Large charcoal square for bigger rooms. 120×120×40cm as shown. Made to order.',
  },
  'coffee-drum-round': {
    name: 'The Round Drum Coffee Table',
    price: 895.0,
    image: 'images/round-concrete-coffee-table-colourful-rug.jpg',
    description: 'Seamless grey-green cylinder, no legs or corners. 90cm across as shown.',
  },
  'dining-table': {
    name: 'Concrete Dining Table — Steel Base',
    price: 1195.0,
    image: 'images/dining-table-steel.jpg',
    description: 'Trowelled concrete top on a black steel frame. 180×90cm, seats six. Made to order.',
  },

  // Older stock-photo table listings, retired from the furniture page in favour
  // of the photographed pieces above. Kept here so any basket saved in a
  // returning customer's browser still prices correctly.
  'coffee-table-wood': {
    name: 'Concrete Coffee Table — Wood Base',
    price: 349.0,
    image: 'images/coffee-table-wood.jpg',
    description: 'A hand-cast concrete top on solid natural wood legs. Approx. 90×50cm.',
  },
  'coffee-table-round': {
    name: 'Round Concrete Coffee Table',
    price: 299.0,
    image: 'images/coffee-table-round.jpg',
    description: 'A polished round concrete top on a slim black metal base. Approx. 70cm diameter.',
  },
}

// Free UK delivery threshold, in pounds. Orders below this pay the flat rate.
export const FREE_DELIVERY_OVER = 40
export const DELIVERY_FLAT_RATE = 4.95
