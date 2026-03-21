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


// 1. Download image to temp file via Puppeteer (Bypasses IP blocks by using the same Proxy)
async function downloadImage(browser, url, dest) {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({
       'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
       'sec-fetch-dest': 'image',
    });
    const viewSource = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    if (!viewSource || !viewSource.ok()) {
       throw new Error(`Failed to load image, HTTP Status: ${viewSource ? viewSource.status() : 'Unknown'}`);
    }
    
    const contentType = viewSource.headers()['content-type'];
    if (contentType && contentType.includes('text/html')) {
       throw new Error('Facebook returned HTML instead of an image file');
    }

    const buffer = await viewSource.buffer();
    if (buffer.length < 1024) throw new Error('Image too small (less than 1KB), likely corrupted');

    fs.writeFileSync(dest, buffer);
  } finally {
    await page.close();
  }
}

// 2. Upload to Convex Storage
async function uploadToConvex(browser, imageUrl) {
  try {
    const tempPath = path.join(os.tmpdir(), `scrape_${Date.now()}.jpg`);
    await downloadImage(browser, imageUrl, tempPath);
    
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
    console.error(`Failed to upload image ${imageUrl}:`, error.message);
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
  const browserArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications', '--ignore-certificate-errors'];

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

  // Better Login Detection & Debugging
  await page.screenshot({ path: "debug_fb_home.jpg" }); // Save screenshot to see what bot sees
  const pageTitle = await page.title();
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl} | Title: ${pageTitle}`);

  const isLoginPage = currentUrl.includes('login') || pageTitle.toLowerCase().includes('log in') || await page.$('#email') !== null;
  const isBlocked = await page.evaluate(() => document.body.innerText.toLowerCase().includes("security check") || document.body.innerText.toLowerCase().includes("captcha"));

  if (isBlocked) {
       console.error("Facebook has blocked this IP or requires a CAPTCHA. Please check 'debug_fb_home.jpg'!");
  } else if (process.env.FB_EMAIL && process.env.FB_PASSWORD) {
    if (isLoginPage) {
      console.log("Not logged in. Logging into Facebook automatically using credentials...");
      // Handle mobile view vs desktop view logins just in case
      const emailSelector = (await page.$('#m_login_email')) ? '#m_login_email' : '#email';
      const passSelector = (await page.$('#m_login_password')) ? '#m_login_password' : '#pass';
      const loginButton = (await page.$('[name="login"]')) ? '[name="login"]' : 'button[type="submit"]';

      await page.type(emailSelector, process.env.FB_EMAIL, {delay: 50});
      await page.type(passSelector, process.env.FB_PASSWORD, {delay: 50});
      
      const loginBtn = await page.$(loginButton);
      if (loginBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          loginBtn.click()
        ]);
        console.log("Login submitted successfully!");
        await page.screenshot({ path: "debug_fb_after_login.jpg" });

        // Check for 2FA Screen
        await new Promise(r => setTimeout(r, 5000)); 
        const twoFaInput = await page.$('#approvals_code') || await page.$('input[name="approvals_code"]');
        if (twoFaInput && process.env.FB_2FA_SECRET) {
            console.log("2FA Challenge detected! Generating OTP code securely...");
            const { authenticator } = require('otplib');
            const cleanSecret = process.env.FB_2FA_SECRET.replace(/\s+/g, '');
            const otpCode = authenticator.generate(cleanSecret);
            
            await page.type('input[name="approvals_code"]', otpCode, {delay: 50});
            await new Promise(r => setTimeout(r, 1000));
            const cpButton = await page.$('#checkpointSubmitButton') || await page.$('button[type="submit"]');
            if(cpButton) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                    cpButton.click()
                ]);
                console.log("2FA OTP Submitted!");
                await page.screenshot({ path: "debug_fb_after_2fa.jpg" });
                
                // Sometimes Facebook asks to "Save Browser"
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
      console.log("Login fields not found. Looks like we are Already logged in via cached cookies!");
    }
  } else {
      console.log("No FB_EMAIL or FB_PASSWORD provided in .env. Assuming already logged in or manual browser.");
  }

  console.log(`Navigating to group: ${groupUrl}...`);
  await page.goto(groupUrl, { waitUntil: 'networkidle2' });
  
  console.log("Waiting 15 seconds to let Facebook group feed load properly...");
  await new Promise(r => setTimeout(r, 15000));
  await page.screenshot({ path: "debug_fb_group.jpg" });

  // Auto-Join Group Logic
  const joinButton = await page.evaluateHandle(() => {
    // Find any button or div with text "Join Group" or "Join"
    const elements = Array.from(document.querySelectorAll('div[role="button"], button'));
    return elements.find(el => el.innerText && (el.innerText.trim() === 'Join Group' || el.innerText.trim() === 'Join'));
  });

  if (joinButton) {
    console.log("Found 'Join Group' button. Clicking it to join...");
    await joinButton.click().catch(() => {});
    console.log("Waiting 5 seconds for join to process...");
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: "debug_fb_after_join.jpg" });
  } else {
    console.log("No 'Join Group' button found. Assuming already joined or group is public.");
  }

  console.log("Scrolling to load more posts...");
  let scrollAttempts = 0;
  const maxScrollAttempts = 12; // Scraper will try to scroll up to 12 times to fetch enough data
  
  while (scrollAttempts < maxScrollAttempts) {
    const postCount = await page.evaluate(() => document.querySelectorAll('div[role="article"]').length);
    process.stdout.write(`[DEBUG] Loaded ${postCount} potential posts... \r`);
    if (postCount >= 35) break; // Aim for 25 valid ones, so load a few extra for safety
    
    const previousHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await new Promise(r => setTimeout(r, 5000)); // Facebook is slow, wait 5s for lazy load
    
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === previousHeight) break; // End of feed
    scrollAttempts++;
  }
  console.log("\nScroll complete.");

  console.log("Extracting posts...");
  // Note: Facebook class names are obfuscated, so we target 'role="article"' which usually wraps posts.
  const postsData = await page.evaluate(() => {
    const posts = document.querySelectorAll('div[role="article"]');
    const data = [];
    
    // Increase limit to 25 posts per group for comprehensive data collection
    Array.from(posts).slice(0, 25).forEach((post) => {
      const text = post.innerText || "";
      // Find actual post images (filtering out emojis and tiny icons)
      const imgs = Array.from(post.querySelectorAll('img'))
                    .map(img => img.src)
                    .filter(src => (src && (src.includes('scontent') || src.includes('fbcdn'))) && !src.includes('emoji'));
      
      // We only care about valid property posts (usually > 50 chars)
      if(text.length > 50) {
        data.push({ text, images: imgs });
      }
    });
    return data;
  });

  console.log(`Found ${postsData.length} valid posts. Processing via DeepSeek...`);
  
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
      for(const imgUrl of post.images.slice(0, 3)) { // max 3 images
         console.log(`Downloading and uploading image: ${imgUrl.substring(0, 40)}...`);
         const uploaded = await uploadToConvex(browser, imgUrl);
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

