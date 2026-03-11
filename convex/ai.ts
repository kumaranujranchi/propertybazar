import { action } from "./_generated/server";
import { v } from "convex/values";

declare const process: any;

/**
 * Parses natural language property search queries into structured JSON.
 * Uses Sarvam AI's sarvam-m model.
 */
export const parseSearchQuery = action({
  args: {
    query: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("SARVAM_API_KEY is not set in environment variables");
      return { success: false, error: "AI search is currently unavailable. Please check backend config.", filters: {} };
    }

    try {
      const systemPrompt = `You are "Dismil", a smart AI real estate assistant for 24Dismil.com.
Your goal is to analyze user requirements deeply and suggest the most relevant properties in India.

WORKFLOW & BEHAVIOR:
1. Analyze Requirements: Deeply understand what the user is looking for (e.g., distinguishing "Plot" from "Apartment").
2. Smart Selection: Instead of just saying "I've applied filters", say something like "Based on your requirements, here are some of the best options available."
3. Language Mirroring: You MUST respond in the EXACT language the user uses (e.g., Hindi, English, Hinglish).
4. Lead Capture: Once you have suggested properties or answered a question, naturally ask for the user's name or mobile number. DO NOT let lead capture block the suggestions.
5. Phone Number Validation: If the user provides a 10-digit number, accept it. Regex: ^[0-9]{10}$.
6. Proactive Suggestions: Even if you are asking for a name, always include the current search criteria in your JSON so the assistant can show live options.
7. ALWAYS return a JSON object at the end of your response inside a block.

JSON SCHEMA:
{
  "type": "buy" | "rent",
  "propType": "Apartment" | "Villa" | "Plot" | "Commercial" | "PG" | "Lodge",
  "bhk": number,
  "city": string,
  "maxPrice": number,
  "amenities": string[],
  "userName": "Extract name if provided",
  "userMobile": "Extract 10-digit number if provided",
  "explanation": "Your natural language response. Talk like a human expert. Analyze their requirements and introduce the upcoming suggestions."
}

RULES:
- SMART SEARCH: You are a machine-learning-powered smart assistant. Act like one.
- PERSISTENT FILTERS: Include filters (city, type, propType, etc.) in EVERY turn.
- DO NOT REPEAT QUESTIONS.
- NO UNNECESSARY CONFIRMATION.
- ACTION AWARENESS: You are presenting property cards inside the chat. Say "Maine aapki requirement ke hisab se niche kuch behtareen options suggest kiye hain."
- Current Date: ${new Date().toLocaleDateString()}
- Use Indian numbering (1 Lac = 100,000, 1 Cr = 10,000,000).
- Be polite and mirror the user's language.`;


      const messages = [
        { role: "system", content: systemPrompt },
        ...(args.history || []),
        { role: "user", content: args.query }
      ];

      const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sarvam AI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      let filters: any = {};
      
      if (jsonMatch) {
        try {
          let jsonStr = jsonMatch[0].trim();
          filters = JSON.parse(jsonStr);
        } catch (e) {
          console.warn("AI JSON parse failed", e);
        }
      }

      // Ensure explanation exists
      if (!filters.explanation || filters.explanation.trim() === "") {
        const textBeforeJson = aiResponse.split('{')[0].trim();
        filters.explanation = textBeforeJson || aiResponse.replace(/\{[\s\S]*\}/, "").trim() || aiResponse;
        if (!filters.explanation || filters.explanation.length < 2) {
            filters.explanation = "I've processed your request based on your criteria.";
        }
      }

      // --- NEW: Smart Property Suggestions ---
      let suggestions: any[] = [];
      if (filters.city || filters.propType || filters.type) {
        // Fetch properties matching the criteria
        // @ts-ignore
        const { api } = await import("./_generated/api");
        let properties = await ctx.runQuery(api.properties.getProperties, { 
          transactionType: filters.type 
        });

        // Smart Filtering logic
        suggestions = properties.filter((p: any) => {
          // City match
          if (filters.city && p.location?.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
          // Property Type match (flexible for Plot/Land)
          if (filters.propType) {
            const targetProp = filters.propType.toLowerCase();
            const pType = p.propertyType.toLowerCase();
            if (targetProp === 'plot' || targetProp === 'land') {
              if (pType !== 'plot' && pType !== 'land') return false;
            } else if (pType !== targetProp) {
              return false;
            }
          }
          // BHK match
          if (filters.bhk && parseInt(p.details?.bhk) !== parseInt(filters.bhk)) return false;
          // Price match
          if (filters.maxPrice && p.pricing?.expectedPrice > filters.maxPrice) return false;

          return true;
        }).slice(0, 3); // Top 3 matches
      }

      return { success: true, filters, suggestions };

    } catch (error: any) {
      console.error("AI Search Error:", error);
      return { success: false, error: error.message || "Internal AI error" };
    }
  },
});

/**
 * Rewrites a property description using Sarvam AI.
 */
export const rewriteDescription = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("SARVAM_API_KEY is not set in environment variables");
      return { success: false, error: "AI is currently unavailable. Please check backend config." };
    }

    try {
      const systemPrompt = `You are an expert real estate copywriter in India.
Your task is to take a raw, potentially broken or short property description and rewrite it into a highly professional, engaging, and grammatically correct description.

RULES:
1. Mirror the Original Language: If the input is in Hindi, respond in Hindi. If English, respond in English. If Hinglish, respond in Hinglish.
2. Structure: Use bullet points for key features and a clean, easy-to-read format. Highlight the main selling points.
3. Tone: Professional, persuasive, and trustworthy.
4. Output: Your response MUST contain ONLY the professional property description. 
5. NO INTROS: Do NOT say "Sure", "Okay", or "Here is the description". Start immediately.
6. NO TAGS: Do NOT use <think>, <thought>, or any other tags.
7. NO MARKDOWN: Do NOT use markdown code blocks (\`\`\`).
8. Language: Use ${args.text.match(/[\u0900-\u097F]/) ? 'Hindi' : 'English/Hinglish'}.`;

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please rewrite this property description: "${args.text}"` }
      ];

      const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sarvam AI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      let aiResponse = data.choices[0]?.message?.content?.trim() || "";
      const rawText = aiResponse;

      // 1. Handle Reasoning Blocks (<think> or <thought>)
      // If there is significant content AFTER a closing reasoning tag, we prefer that.
      // If the content is mostly inside or the tags are unclosed, we just strip the tags.
      const closedTagMatch = aiResponse.match(/[\s\S]*<\/(?:think|thought)>([\s\S]*)/i);
      if (closedTagMatch && closedTagMatch[1].trim().length > 20) {
        aiResponse = closedTagMatch[1].trim();
      } else {
        // Strip only the tags themselves (e.g. <think>, </think>), keeping whatever is between them
        aiResponse = aiResponse.replace(/<[^>]+>/gi, "").trim();
      }

      // 2. Strip leading/trailing markdown code blocks
      aiResponse = aiResponse.replace(/^```[a-z]*\n?|(\n?```)$/gi, "").trim();

      // 3. Remove common intro headers (strictly at the beginning) including Hindi
      const introRegex = /^[\s\n]*(?:rewritten\s+description:|professional\s+description:|description:|rewritten:|विवरण:|प्रोफेशनल विवरण:|your\s+rewritten\s+description:)/i;
      aiResponse = aiResponse.replace(introRegex, "").trim();

      // 4. Remove bolding
      aiResponse = aiResponse.replace(/\*\*/g, "");

      if (!aiResponse || aiResponse.length < 5) {
        console.warn("AI output was empty after cleaning. Raw:", rawText);
        return { success: true, text: args.text, debug: { raw: rawText, processed: aiResponse } };
      }

      return { success: true, text: aiResponse, debug: { raw: rawText, processed: aiResponse } };

    } catch (error: any) {
      console.error("AI Rewrite Error:", error);
      return { success: false, error: error.message || "Internal AI error during rewrite" };
    }
  }
});
