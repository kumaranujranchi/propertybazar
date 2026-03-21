require('dotenv').config();
console.log("[DEBUG] Loaded dotenv.");
const puppeteer = require('puppeteer');
console.log("[DEBUG] Loaded puppeteer.");


const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const siteUrl = process.env.CONVEX_URL.replace('.cloud', '.site');
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
console.log("[DEBUG] Initialization complete, ready to run scraper.");


// 1. Download image to temp file
async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// 2. Upload to Convex Storage
async function uploadToConvex(imageUrl) {
  try {
    const tempPath = path.join(os.tmpdir(), `scrape_${Date.now()}.jpg`);
    await downloadImage(imageUrl, tempPath);
    
    // Get upload URL using REST API
    const authRes = await fetch(`${siteUrl}/scraper/uploadUrl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: SCRAPER_API_KEY })
    });
    if (!authRes.ok) throw new Error("Failed to get upload URL: " + await authRes.text());
    const { url: uploadUrl } = await authRes.json();
    
    // Read file and upload via HTTP
    const imageBuffer = fs.readFileSync(tempPath);
    
    // Native NodeJS fetch
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: imageBuffer,
    });
    const { storageId } = await result.json();
    
    fs.unlinkSync(tempPath); // cleanup
    return { storageId, category: "Property" };
  } catch (error) {
    console.error("Failed to upload image:", error);
    return null;
  }
}

// 3. Process text with OpenAI
async function processTextWithAI(rawText) {
  const prompt = `
  You are an expert real estate data extraction assistant.
  Extract the following property details from the given unstructured Facebook post text.
  Return ONLY a valid JSON object matching the exact keys below.
  If a detail is missing, provide a sensible default (like "N/A" or 0) based on the context.
  
  Expected JSON schema:
  {
    "transactionType": "Sell" | "Rent",
    "propertyType": "Apartment" | "House/Villa" | "Plot" | "Commercial",
    "location": {
      "city": "String",
      "locality": "String",
      "society": "String (optional)"
    },
    "details": {
      "bhk": "String or Number",
      "bathrooms": "String or Number",
      "balconies": "String or Number",
      "builtUpArea": "String (e.g., '1200 Sq.Ft.')",
      "furnishing": "Unfurnished" | "Semi-Furnished" | "Fully-Furnished",
      "projectName": "String (if any)"
    },
    "amenities": ["Array of strings (e.g., 'Parking', 'Lift')"],
    "pricing": {
      "expectedPrice": Number (e.g., 5000000),
      "pricePerSqFt": Number (optional),
      "maintenance": Number (optional)
    },
    "contactDesc": {
      "ownerName": "Unknown Owner",
      "ownerPhone": "String - Extract the phone number",
      "agentDetails": "Unknown Agent"
    }
  }

  Raw Text to analyse:
  """${rawText}"""
  `;

  const requestBody = {
    model: "deepseek-chat",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }]
  };

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if(!data.choices || !data.choices[0]) throw new Error("Unexpected DeepSeek response: " + JSON.stringify(data));
  return JSON.parse(data.choices[0].message.content);
}

// 4. Main Scraper function
async function runScraper(groupUrl) {
  if(!process.env.DEEPSEEK_API_KEY || !process.env.CONVEX_URL || !process.env.SCRAPER_API_KEY) {
     console.error("Missing environment variables in .env file!");
     process.exit(1);
  }

  console.log("Starting Chrome browser...");
  // headless: false -> shows the browser. Essential for first-time FB login.
  // userDataDir -> caches cookies, so subsequent runs don't need manual login.
  // Setup standard cloud arguments
  const browserArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications'];

  // Add Proxy Argument if exists
  if (process.env.PROXY_SERVER) {
     browserArgs.push(`--proxy-server=${process.env.PROXY_SERVER}`);
     console.log("Using External Proxy Server...");
  }

  // Use headless mode and disable sandbox for cloud environments like Render
  const browser = await puppeteer.launch({ 
    headless: true, // "new" headless mode is standard now
    userDataDir: "./user_data",
    args: browserArgs
  });
  
  const page = await browser.newPage();

  // Proxy Authentication if required by Proxy Provider
  if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({
         username: process.env.PROXY_USERNAME,
         password: process.env.PROXY_PASSWORD
      });
  }

  
  console.log("Checking Facebook login status...");
  await page.goto("https://www.facebook.com/", { waitUntil: 'networkidle2' });

  // Auto-login logic for Cloud (Render)
  if (process.env.FB_EMAIL && process.env.FB_PASSWORD) {
    const emailInput = await page.$('#email');
    if (emailInput) {
      console.log("Logging into Facebook automatically using credentials...");
      await page.type('#email', process.env.FB_EMAIL, {delay: 50});
      await page.type('#pass', process.env.FB_PASSWORD, {delay: 50});
      
      const loginButton = await page.$('[name="login"]');
      if (loginButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          loginButton.click()
        ]);
        console.log("Login submitted successfully!");

        // Check for 2FA Screen
        await new Promise(r => setTimeout(r, 5000)); // wait for FB to redirect to 2FA Page
        const twoFaInput = await page.$('#approvals_code') || await page.$('input[name="approvals_code"]');
        if (twoFaInput && process.env.FB_2FA_SECRET) {
            console.log("2FA Challenge detected! Generating OTP code securely...");
            const { authenticator } = require('otplib');
            const cleanSecret = process.env.FB_2FA_SECRET.replace(/\\s+/g, '');
            const otpCode = authenticator.generate(cleanSecret);
            
            await page.type('input[name="approvals_code"]', otpCode, {delay: 50});
            await new Promise(r => setTimeout(r, 1000));
            const cpButton = await page.$('#checkpointSubmitButton');
            if(cpButton) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                    cpButton.click()
                ]);
                console.log("2FA OTP Submitted!");
                
                // Sometimes Facebook asks to "Save Browser", we must click continue again
                await new Promise(r => setTimeout(r, 3000));
                const saveBrowserButton = await page.$('#checkpointSubmitButton');
                if(saveBrowserButton) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                        saveBrowserButton.click()
                    ]);
                    console.log("Saved browser settings!");
                }
            }
        }
      }
    } else {
      console.log("Already logged in via cached cookies.");
    }
  } else {
      console.log("No FB_EMAIL or FB_PASSWORD provided in .env. Assuming already logged in or manual browser.");
  }

  console.log(`Navigating to group: ${groupUrl}...`);
  await page.goto(groupUrl, { waitUntil: 'networkidle2' });
  
  console.log("Waiting 15 seconds to let Facebook group feed load properly...");
  await new Promise(r => setTimeout(r, 15000));

  console.log("Extracting posts...");
  // Note: Facebook class names are obfuscated, so we target 'role="article"' which usually wraps posts.
  const postsData = await page.evaluate(() => {
    const posts = document.querySelectorAll('div[role="article"]');
    const data = [];
    
    // Only process the first 3 posts for safety testing
    Array.from(posts).slice(0, 3).forEach((post) => {
      const text = post.innerText || "";
      // Find actual post images (filtering out emojis and tiny icons)
      const imgs = Array.from(post.querySelectorAll('img'))
                    .map(img => img.src)
                    .filter(src => (src.includes('scontent') || src.includes('fbcdn')) && !src.includes('emoji'));
      
      // We only care about large texts indicative of a property post
      if(text.length > 50) {
        data.push({ text, images: imgs });
      }
    });
    return data;
  });

  console.log(`Found ${postsData.length} valid posts. Processing via OpenAI...`);
  
  for (const post of postsData) {
    try {
      console.log("\\n-----------------------------------------");
      console.log("Raw text snippet:", post.text.substring(0, 100).replace(/\\n/g, " ") + "...");
      
      const propertyData = await processTextWithAI(post.text);

      // Create a unique hash of the raw text so we can block duplicates
      const sourceHash = crypto.createHash('sha256').update(post.text).digest('hex');
      propertyData.details = propertyData.details || {};
      propertyData.details.sourceHash = sourceHash;

      console.log("AI Parsed Data:", JSON.stringify(propertyData, null, 2));
      
      // Upload Images
      const photos = [];
      for(const imgUrl of post.images.slice(0, 3)) { // max 3 images so we don't overkill
         console.log(`Downloading and uploading image: ${imgUrl.substring(0, 40)}...`);
         const uploaded = await uploadToConvex(imgUrl);
         if(uploaded) photos.push(uploaded);
      }
      propertyData.photos = photos;

      // Submit to Convex Database
      console.log("Inserting property into Convex...");
      const dbRes = await fetch(`${siteUrl}/scraper/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: SCRAPER_API_KEY,
          ...propertyData,
        })
      });
      if (!dbRes.ok) throw new Error("Failed to insert property: " + await dbRes.text());
      const dbResult = await dbRes.json();
      console.log("Property inserted successfully! ID:", dbResult.propertyId);
    } catch(e) {
      console.error("Error processing post:", e.message || e);
    }
  }

  await browser.close();
  console.log("\\nScraping finished.");
}

const targetGroupsString = process.argv[2] || 'https://www.facebook.com/groups/Group1,https://www.facebook.com/groups/Group2';
const targetGroups = targetGroupsString.split(',').map(g => g.trim()).filter(Boolean);

(async function runAll() {
  for (const group of targetGroups) {
    console.log(`\n\n=== Starting Scraping for Group: ${group} ===`);
    try {
      await runScraper(group);
    } catch(e) {
      console.error(`Error scraping group ${group}:`, e.message);
    }
  }
})();

