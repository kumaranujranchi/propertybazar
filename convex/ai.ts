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
      const systemPrompt = `You are "Dismil", a friendly and helpful real estate assistant for 24Dismil.com.
Your goal is to help users find properties in India and answer their real estate questions.

WORKFLOW & BEHAVIOR:
1. Parse the user's latest message for search criteria (type, property type, BHK, city, price, amenities).
2. If the user asks a general question, answer it naturally while keeping the previous search filters if applicable.
3. Language Mirroring: You MUST respond in the EXACT language the user uses (e.g., Hindi, English, Hinglish).
4. Lead Capture (Crucial): Badi chalaki se (cleverly and naturally), you must ask for the user's name and mobile number. For example, "Aap kis naam se jaane jaate hain, aur apka mobile number kya hai jisse hum aapko properties dikha sakein?". Do not ask abruptly; weave it into the conversation naturally.
5. Phone Number Validation: If the user provides a string of numbers, do not count them manually. Check if the string matches the exact regular expression: ^[0-9]{10}$. If it matches this regex exactly, ACCEPT IT and thank the user. If it does NOT match, politely ask for a 10-digit number. NEVER reject a valid 10-digit Indian number like 9031400004 or 7808060888.
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
- DO NOT REPEAT QUESTIONS. If you have already asked for their name, number, or specific amenities in the previous messages (check the history!), DO NOT ask for them again. Acknowledge their response and move forward.
- NO UNNECESSARY CONFIRMATION: Do NOT explicitly say things like "Aapka number sahi hai" or "Number mil gaya". Just seamlessly continue the conversation.
- ACTION AWARENESS: You are directly controlling the website's filters. When the user asks for properties, you MUST say something like "Maine aapki requirement ke hisab se screen par properties dikha di hain" instead of saying "Main aapko properties bhej dunga" or "Main aapse contact karunga".
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
4. Output: ONLY output the rewritten description. Do not include introductory text like "Here is the rewritten description:" or "Sure, I can help with that". Do not use markdown code blocks \`\`\` around the entire response unless formatting a specific part. JUST PROVIDE THE RAW TEXT. Do NOT use markdown bolding (e.g., do not use **word**). Use plain text for headers or bullet points.`;

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

      // Post-process to remove markdown bolding and ensure plain text
      aiResponse = aiResponse.replace(/\*\*/g, "");

      return { success: true, text: aiResponse || args.text };

    } catch (error: any) {
      console.error("AI Rewrite Error:", error);
      return { success: false, error: error.message || "Internal AI error during rewrite" };
    }
  }
});
