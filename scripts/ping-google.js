const axios = require('axios');

const SITEMAP_URL = 'https://24dismil.com/sitemap.xml';

async function pingGoogle() {
  try {
    const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const response = await axios.get(url);
    console.log('Successfully pinged Google! Status:', response.status);
  } catch (error) {
    console.error('Failed to ping Google:', error.message);
  }
}

pingGoogle();
