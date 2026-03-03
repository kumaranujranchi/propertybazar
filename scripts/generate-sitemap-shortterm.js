const fs = require('fs');
const axios = require('axios');

const BASE_URL = process.env.SITE_URL || 'https://24dismil.com';
const OUTPUT = './public/sitemap-shortterm.xml';
// Expect an API that returns active project list in JSON. Adjust as needed for your backend.
const API = process.env.PROJECTS_API || 'http://localhost:3000/api/projects?status=active&maxAgeDays=30';

(async () => {
  try {
    const res = await axios.get(API);
    const projects = res.data || [];
    const urls = projects.map(p => {
      const lastmod = new Date(p.updatedAt || p.publishedAt || Date.now()).toISOString().split('T')[0];
      return `  <url>\n    <loc>${BASE_URL}/projects/${p.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }).join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

    fs.mkdirSync('./public', { recursive: true });
    fs.writeFileSync(OUTPUT, sitemap, 'utf8');
    console.log('sitemap written to', OUTPUT);
  } catch (err) {
    console.error('sitemap generation failed', err.message);
    process.exit(1);
  }
})();
