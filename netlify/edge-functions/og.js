export default async (request, context) => {
  const url = new URL(request.url);

  // List of common social media and messaging bots
  const bots = [
    "facebookexternalhit",
    "facebookcatalog",
    "twitterbot",
    "whatsapp",
    "telegrambot",
    "linkedinbot",
    "pinterest",
    "slackbot",
    "discordbot",
    "skypeuripreview",
    "ia_archiver",
    "applebot"
  ];

  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  const isBot = bots.some(bot => userAgent.includes(bot));

  if (isBot) {
    const propertyId = url.searchParams.get("id");
    const propertySlug = url.searchParams.get("slug");

    // Defaults that will be overridden if data is fetched successfully
    let ogTitle = "Property Details | 24Dismil";
    let ogDescription = "View detailed information, photos, and amenities of this property on 24Dismil.";
    let ogImage = "https://24dismil.com/images/hero-bg.jpg";
    let ogImageWidth = "1200";
    let ogImageHeight = "630";
    let ogImageType = "image/jpeg";
    let canonicalUrl = url.toString();

    if (propertyId || propertySlug) {
      // Call our Convex HTTP endpoint for dynamic OG data
      const convexUrl = new URL("https://compassionate-mockingbird-459.convex.site/og");
      if (propertyId) convexUrl.searchParams.set("id", propertyId);
      if (propertySlug) convexUrl.searchParams.set("slug", propertySlug);

      try {
        const response = await fetch(convexUrl.toString());
        if (response.ok) {
          const ogData = await response.json();
          if (ogData.title) ogTitle = ogData.title;
          if (ogData.description) ogDescription = ogData.description;
          if (ogData.image) {
            ogImage = ogData.image;
            // Convex storage images are jpgs/pngs — update type accordingly
            if (ogImage.includes(".png")) {
              ogImageType = "image/png";
            } else {
              ogImageType = "image/jpeg";
            }
            // We don't know dimensions from Convex, use recommended 1200x630
            ogImageWidth = "1200";
            ogImageHeight = "630";
          }
        }
      } catch (err) {
        console.error("Error fetching OG data from Convex:", err);
        // Will fall through with defaults
      }
    }

    // Return HTML with all dynamic Open Graph meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="${ogImageWidth}" />
  <meta property="og:image:height" content="${ogImageHeight}" />
  <meta property="og:image:type" content="${ogImageType}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p>${escapeHtml(ogDescription)}</p>
  <img src="${escapeHtml(ogImage)}" alt="Property" />
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // Regular browser — pass through to the normal static HTML page
  return context.next();
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const config = { path: "/property-detail.html" };
