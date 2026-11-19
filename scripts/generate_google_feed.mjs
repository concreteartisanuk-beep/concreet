import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { CATALOGUE } from '../assets/catalogue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const feedPath = path.join(rootDir, 'google-shopping-feed.xml');

// Read site-data.js
const siteDataCode = fs.readFileSync(path.join(rootDir, 'site-data.js'), 'utf8');
const ctx = {};
vm.runInNewContext(siteDataCode, ctx);
const shopProducts = ctx.SITE_DATA.shop.products || [];

const allProductMap = new Map();
shopProducts.forEach(p => {
  allProductMap.set(p.id, { ...p });
});
Object.entries(CATALOGUE).forEach(([id, p]) => {
  if (allProductMap.has(id)) {
    allProductMap.set(id, { ...allProductMap.get(id), ...p, id });
  } else {
    allProductMap.set(id, { ...p, id });
  }
});

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getGoogleCategory(category, name) {
  const n = (name || '').toLowerCase();
  if (category === 'shelves') {
    return 'Home &amp; Garden &gt; Decor &gt; Wall Shelves &amp; Ledges';
  } else if (category === 'furniture') {
    if (n.includes('dining')) {
      return 'Furniture &gt; Tables &gt; Kitchen &amp; Dining Room Tables';
    }
    return 'Furniture &gt; Tables &gt; Coffee Tables';
  } else if (category === 'candles') {
    return 'Home &amp; Garden &gt; Decor &gt; Home Fragrances &gt; Candles';
  } else if (n.includes('diffuser') || category === 'homeware') {
    return 'Home &amp; Garden &gt; Decor &gt; Home Fragrances &gt; Fragrance Diffusers';
  } else if (category === 'skincare') {
    if (n.includes('lip')) {
      return 'Health &amp; Beauty &gt; Personal Care &gt; Cosmetics &gt; Skin Care &gt; Lip Balms &amp; Treatments';
    }
    return 'Health &amp; Beauty &gt; Personal Care &gt; Cosmetics &gt; Bath &amp; Body &gt; Bar Soaps';
  } else if (category === 'clocks') {
    return 'Home &amp; Garden &gt; Decor &gt; Clocks &gt; Wall Clocks';
  } else if (category === 'bowls') {
    return 'Home &amp; Garden &gt; Decor &gt; Bowls';
  }
  return 'Home &amp; Garden &gt; Decor';
}

function getProductType(category, name) {
  const n = (name || '').toLowerCase();
  if (category === 'shelves') return 'Decor &gt; Floating Shelves &gt; Microcement Shelving';
  if (category === 'furniture') return 'Furniture &gt; Living Room Tables &gt; Concrete Tables';
  if (category === 'candles') return 'Home Fragrance &gt; Scented Candles &gt; Soy Wax Concrete Candles';
  if (n.includes('diffuser')) return 'Home Fragrance &gt; Diffusers &gt; Volcanic Basalt Diffusers';
  if (category === 'skincare') return 'Personal Care &gt; Natural Skincare';
  if (category === 'clocks') return 'Home Decor &gt; Wall Clocks &gt; Concrete Clocks';
  if (category === 'bowls') return 'Home Decor &gt; Decorative Bowls &gt; Concrete Centerpieces';
  return 'Home Decor &gt; Handcrafted Concrete';
}

const itemsXml = [];

for (const [id, item] of allProductMap.entries()) {
  const name = item.name || 'Handcrafted Concrete Piece';
  const price = Number(item.price || 0).toFixed(2);
  const desc = item.description || 'Architectural handcrafted concrete homeware from Concreet UK.';
  let imgSrc = item.image || 'images/soap.webp';
  if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
  const absoluteImgUrl = 'https://concreet.co.uk/' + imgSrc;
  const link = `https://concreet.co.uk/product/${id}`;
  const gCategory = getGoogleCategory(item.category, name);
  const pType = getProductType(item.category, name);
  const shippingFee = Number(price) >= 40 ? '0.00' : '4.95';

  itemsXml.push(`    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${escapeXml(name)}</g:title>
      <g:description>${escapeXml(desc)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(absoluteImgUrl)}</g:image_link>
      <g:price>${price} GBP</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>Concreet</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${gCategory}</g:google_product_category>
      <g:product_type>${pType}</g:product_type>
      <g:shipping>
        <g:country>GB</g:country>
        <g:service>Tracked UK Courier</g:service>
        <g:price>${shippingFee} GBP</g:price>
      </g:shipping>
    </item>`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Concreet Handcrafted Homeware &amp; Architectural Furniture</title>
    <link>https://concreet.co.uk</link>
    <description>UK artisan handcrafted concrete homeware, microcement floating shelves, volcanic diffusers, and luxury concrete tables.</description>
${itemsXml.join('\n')}
  </channel>
</rss>
`;

fs.writeFileSync(feedPath, xml, 'utf8');
console.log(`Successfully generated Google Shopping feed with ${itemsXml.length} products at ${feedPath}`);
