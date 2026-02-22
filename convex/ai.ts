import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Parses natural language property search queries into structured JSON.
 * Uses Sarvam AI's sarvam-m model.
 */
export const parseSearchQuery = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("SARVAM_API_KEY is not set in environment variables");
      // Return a basic fallback or error
      return { success: false, error: "AI search is currently unavailable. Please check backend config.", filters: {} };
    }

    try {
      const systemPrompt = `You are an expert real estate search assistant for "24Dismil.com", a property portal in India.
Your task is to parse user queries and return ONLY a structured JSON object representing their search criteria.

SCHEMA:
{
  "type": "buy" | "rent",
  "propType": "Apartment" | "Villa" | "Plot" | "Commercial" | "PG" | "Lodge",
  "bhk": number,
  "city": string,
  "maxPrice": number,
  "amenities": string[],
  "explanation": string (A brief, friendly message in the user's language explaining what you found)
}

RULES:
1. Return ONLY the JSON object. No other text.
2. If "type" (buy/rent) is not specified, default to "buy".
3. Use Indian Numbering System: 1 Lac = 100000, 1 Cr = 10000000.
4. "city" should be the name of the city or locality mentioned.
5. If some criteria are missing, omit the field or set to null/empty.
6. The "explanation" should be professional and encouraging.

Example: "Patna mein 2bhk flat chahiye 40 lakh ke andar"
Output: {"type": "buy", "propType": "Apartment", "bhk": 2, "city": "Patna", "maxPrice": 4000000, "explanation": "Sure! I am searching for 2 BHK apartments in Patna within ₹40 Lacs for you."}`;

      const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.query }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Sarvam AI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      // Extract JSON from response (handling potential markdown fences)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const filters = JSON.parse(jsonMatch[0]);
        return { success: true, filters };
      }

      return { success: false, error: "Failed to parse AI response", raw: aiResponse };

    } catch (error: any) {
      console.error("AI Search Error:", error);
      return { success: false, error: error.message || "Internal AI error" };
    }
  },
});
