import { action } from "./_generated/server";
import { v } from "convex/values";

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
      const systemPrompt = `You are "Dismil", a friendly and helpful real estate assistant for 24Dismil.com.
Your goal is to help users find properties in India and answer their real estate questions.

WORKFLOW & BEHAVIOR:
1. Parse the user's latest message for search criteria (type, property type, BHK, city, price, amenities).
2. If the user asks a general question, answer it naturally while keeping the previous search filters if applicable.
3. Language Mirroring: You MUST respond in the EXACT language the user uses (e.g., Hindi, English, Hinglish).
4. Lead Capture (Crucial): Badi chalaki se (cleverly and naturally), you must ask for the user's name and mobile number. For example, "Aap kis naam se jaane jaate hain, aur apka mobile number kya hai jisse hum aapko properties dikha sakein?". Do not ask abruptly; weave it into the conversation naturally.
5. Phone Number Validation: If the user provides a phone number, check if it is exactly 10 digits long. If it is 9 digits, 11 digits, or invalid, politely ask them to provide a correct 10-digit number.
6. ALWAYS return a JSON object at the end of your response inside a block.

JSON SCHEMA:
{
  "type": "buy" | "rent",
  "propType": "Apartment" | "Villa" | "Plot" | "Commercial" | "PG" | "Lodge",
  "bhk": number,
  "city": string,
  "maxPrice": number,
  "amenities": string[],
  "userName": "Extract the user's name if they provided it",
  "userMobile": "Extract the user's 10-digit mobile number if they provided it",
  "explanation": "Your natural language response to the user. Talk like a human, not a robot. Ask for their requirements, name, or phone number naturally here."
}

RULES:
- Maintain context from the history. If they say "Show flats in Patna" then "What about Noida?", update city to "Noida".
- Current Date: ${new Date().toLocaleDateString()}
- Use Indian numbering (1 Lac = 100,000, 1 Cr = 10,000,000).
- Be polite, professional, and mirror the user's language.`;


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
      if (jsonMatch) {
        try {
          const filters = JSON.parse(jsonMatch[0]);
          return { success: true, filters };
        } catch (e) {
          return { success: true, filters: { explanation: aiResponse } };
        }
      }

      return { success: true, filters: { explanation: aiResponse } };

    } catch (error: any) {
      console.error("AI Search Error:", error);
      return { success: false, error: error.message || "Internal AI error" };
    }
  },
});
