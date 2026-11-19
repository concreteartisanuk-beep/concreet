import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { CATALOGUE } from '../assets/catalogue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sitemapPath = path.join(rootDir, 'sitemap.xml');

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

const today = new Date().toISOString().split('T')[0];

const corePages = [
  { url: 'https://concreet.co.uk/', priority: '1.0', changefreq: 'daily' },
  { url: 'https://concreet.co.uk/shop', priority: '0.95', changefreq: 'daily' },
  { url: 'https://concreet.co.uk/furniture', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops', priority: '0.95', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-newcastle', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-durham', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-sunderland', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-middlesbrough', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-northumberland', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-london', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-manchester', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/microcement-worktops-birmingham', priority: '0.90', changefreq: 'weekly' },
  { url: 'https://concreet.co.uk/about', priority: '0.70', changefreq: 'monthly' },
  { url: 'https://concreet.co.uk/contact', priority: '0.70', changefreq: 'monthly' },
  { url: 'https://concreet.co.uk/delivery-returns', priority: '0.60', changefreq: 'monthly' },
  { url: 'https://concreet.co.uk/privacy', priority: '0.30', changefreq: 'yearly' },
  { url: 'https://concreet.co.uk/terms', priority: '0.30', changefreq: 'yearly' },
  { url: 'https://concreet.co.uk/product', priority: '0.50', changefreq: 'weekly' }
];

const urlsXml = [];

// Add core pages
for (const p of corePages) {
  urlsXml.push(`  <url>
    <loc>${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
}

// Add each product page with Image extensions
for (const [id, item] of allProductMap.entries()) {
  const name = item.name || 'Handcrafted Concrete Piece';
  const desc = item.description || '';
  let imgSrc = item.image || 'images/soap.webp';
  if (imgSrc.startsWith('/')) imgSrc = imgSrc.substring(1);
  const absoluteImgUrl = 'https://concreet.co.uk/' + imgSrc;
  const productUrl = `https://concreet.co.uk/product/${id}`;

  urlsXml.push(`  <url>
    <loc>${productUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
    <image:image>
      <image:loc>${escapeXml(absoluteImgUrl)}</image:loc>
      <image:title>${escapeXml(name)} | Concreet UK</image:title>
      <image:caption>${escapeXml(desc.substring(0, 200))}</image:caption>
    </image:image>
  </url>`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlsXml.join('\n')}
</urlset>
`;

fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Successfully generated sitemap with ${urlsXml.length} URLs (including image extensions) at ${sitemapPath}`);
