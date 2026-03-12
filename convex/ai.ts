import { action } from "./_generated/server";
import { v } from "convex/values";

declare const process: any;

/**
 * Parses natural language property search queries into structured JSON.
 * Uses Sarvam AI's sarvam-1 model.
 */
export const parseSearchQuery = action({
  args: {
    query: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, args) => {
    const fuzzyMatch = (str: string, target: string) => {
      const s = str.toLowerCase().trim();
      const t = target.toLowerCase();
      // Guard: don't match extremely short user inputs (eg. "hi", "ok") against city substrings
      if (s.length === 0) return false;
      if (s === t) return true;
      // If the user input is at least 3 chars, allow substring matches both ways.
      if (s.length >= 3 && (s.includes(t) || t.includes(s))) return true;
      // For short inputs (<3), require a stricter check (word boundary exact match)
      if (s.length < 3) {
        const re = new RegExp(`\\b${s.replace(/[-\\/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\b`, 'i');
        if (re.test(t)) return true;
      }

      // Fallback: simple character-difference heuristic (small edit distance)
      let distance = 0;
      const len = Math.min(s.length, t.length);
      for (let i = 0; i < len; i++) {
        if (s[i] !== t[i]) distance++;
      }
      distance += Math.abs(s.length - t.length);
      return distance <= 2;
    };

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("SARVAM_API_KEY is not set");
      return { success: false, error: "AI search is currently unavailable.", filters: {} };
    }

    // --- TRUE HYBRID: KEYWORD SCANNER (Runs BEFORE AI) ---
    const userText = args.query.toLowerCase().trim();
    const scannedFilters: any = {};

    // Early detection of pure greetings/closing words so we don't accidentally
    // treat them as cities or other filters (e.g., "thanks" matching "Thane").
    const isGreeting = /^(hi|hello|hey|hei|namaste|morning|evening|heya|yo|hlo|hii|hiii)$/i.test(userText);
    const isStatus = /^(ok|okay|nice|good|fine|waht|what|ji|thik|theek|perfect|great|done|over|thanks|thank you|ty|shukriya|dhanyawad)$/i.test(userText);
    
    // 1. Extract Property Type via strict keywords
    if (/\b(flat|apartment|2bhk|3bhk|1bhk|bhk)\b/i.test(userText)) scannedFilters.propType = "Apartment";
    else if (/\b(plot|land|zamin|bhukhand)\b/i.test(userText)) scannedFilters.propType = "Plot";
    else if (/\b(villa|bungalow|house|makan|kothi)\b/i.test(userText)) scannedFilters.propType = "Villa";
    else if (/\b(shop|office|retail|commercial|dukan)\b/i.test(userText)) scannedFilters.propType = "Commercial";

    // 2. Extract City via Database Lookup + Fuzzy Matching
    // @ts-ignore
    const { api } = await import("./_generated/api");
    const allCities = await ctx.runQuery(api.properties.getUniqueCities);
    const commonCities = ["Patna", "Delhi", "Ranchi", "Mumbai", "Bangalore", "Kolkata", "Chennai", "Lucknow", "Jaipur", "Ahmedabad", "Gurgaon", "Noida"];
    const citiesToSearch = Array.from(new Set([...allCities, ...commonCities]));

    // Only run city detection if the input is not a pure greeting/closing word.
    if (!isGreeting && !isStatus) {
      for (const city of citiesToSearch) {
        if (userText.includes(city.toLowerCase()) || fuzzyMatch(userText, city)) {
          scannedFilters.city = city;
          break;
        }
      }
    }

    // 3. Extract BHK
    const bhkMatch = userText.match(/(\d)\s*bhk/i);
    if (bhkMatch) scannedFilters.bhk = bhkMatch[1];

    // 4. Extract Rent/Sale Intent
    if (/\b(rent|rental|kiraya|lp|lease|kiraye)\b/i.test(userText)) scannedFilters.type = "Rent";
    else if (/\b(buy|purchase|sale|sell|bechna|kharidna|bechana)\b/i.test(userText)) scannedFilters.type = "Sale";

    const systemPrompt = `You are 24Dismil Ai Assitance, a smart real estate buddy for 24Dismil.com.
Your job is to help users find properties and engage in friendly conversation.

HOW TO RESPOND:
1. Search Intent: If the user is looking for property, extract criteria into JSON.
2. General Chat: If the user asks general questions, says thanks, or just chats, respond warmly in the "explanation" field and keep filters empty.
3. Language: Always mirror the user's language (Hindi/English/Hinglish).

SEARCH CRITERIA:
- "city": string (e.g. "Patna", "Delhi")
- "type": "Rent" or "Sale"
- "propType": "Apartment", "Villa", "Plot", "Commercial", "PG"
- "bhk": string (e.g. "2", "3")
- "maxPrice": number (total budget in Rupees)
- "explanation": A warm, human, conversational message.

RULES:
- ALREADY EXTRACTED: ${JSON.stringify(scannedFilters)}. Prioritize these.
- If you have ONLY PropType but NO City, ask for the city politely.
- If the user is closing the conversation (e.g., "ok thanks"), simply respond politely.
- NO internal reasoning. ONLY return JSON.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(args.history || []),
      { role: "user", content: args.query }
    ];

    try {
    let filters: any = {};
    let aiExplanation = "";

    try {
      const response = await fetch("https://api.sarvam.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey
        },
        body: JSON.stringify({
          model: "sarvam-m",
          messages: messages,
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (response.ok) {
        const data = await response.json();
        let aiResponse = data.choices[0]?.message?.content || "";
        aiResponse = aiResponse.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, "").replace(/<(?:think|thought)>[\s\S]*/gi, "").trim();
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            filters = JSON.parse(jsonMatch[0].trim());
            aiExplanation = filters.explanation || "";
          } catch (e) { console.warn("AI JSON parse failed", e); }
        }
      }
    } catch (e) {
      console.warn("AI call failed.", e);
    }

    // Set a helpful explanation if AI didn't provide one
    if (aiExplanation) {
        filters.explanation = aiExplanation;
    } else if (filters.city) {
        const city = filters.city;
        const propType = filters.propType || "property";
        const bhk = filters.bhk ? `${filters.bhk} BHK ` : "";
        filters.explanation = `Ji, main aapke liye ${city} mein ${bhk}${propType} check kar raha hoon...`;
    } else if (filters.propType) {
        filters.explanation = `Bilkul! Aap ${filters.propType} kaunse city mein dhoondh rahe hain?`;
    } else if (isStatus) {
        filters.explanation = "Ji bilkul! Iske alawa agar koi aur specific requirement ho to zaroor batayein. I'm here to help!";
    } else {
        filters.explanation = "I understand. To help you better, could you tell me which city and what type of property (Flat, Villa, or Plot) you are looking for?";
    }

    // Final cleanup: strip any stray HTML/debug tags like <think> that may remain
    if (filters && typeof filters.explanation === 'string') {
      filters.explanation = filters.explanation.replace(/<[^>]+>/gi, '').trim();
    }

      // --- Smart Property Suggestions ---
      let suggestions: any[] = [];
      const hasMinimumCriteria = filters.city || filters.propType;
      
      if (hasMinimumCriteria) {
        // Fetch properties
        let properties = await ctx.runQuery(api.properties.getProperties, { 
          transactionType: filters.type 
        });

        // Filter
        suggestions = properties.filter((p: any) => {
          if (filters.city) {
            const searchCity = filters.city.toLowerCase();
            const pCity = (p.location?.city || "").toLowerCase();
            const pLocality = (p.location?.locality || "").toLowerCase();
            const cityMatch = pCity && (userText.includes(pCity) || pCity.includes(searchCity) || fuzzyMatch(pCity, searchCity));
            const localityMatch = pLocality && (userText.includes(pLocality) || pLocality.includes(searchCity) || fuzzyMatch(pLocality, searchCity));
            if (!cityMatch && !localityMatch) return false;
          }
          if (filters.propType) {
            const targetProp = filters.propType.toLowerCase();
            const pType = (p.propertyType || "").toLowerCase();
            const isTargetApartment = targetProp === 'apartment' || targetProp === 'flat';
            const isTargetPlot = targetProp === 'plot' || targetProp === 'land';
            const isPropertyApartment = pType === 'apartment' || pType === 'flat';
            const isPropertyPlot = pType === 'plot' || pType === 'land';
            if (isTargetApartment && !isPropertyApartment) return false;
            if (isTargetPlot && !isPropertyPlot) return false;
            if (!isTargetApartment && !isTargetPlot && pType !== targetProp) return false;
          }
          if (filters.bhk && parseInt(p.details?.bhk) !== parseInt(filters.bhk)) return false;
          if (filters.maxPrice && p.pricing?.expectedPrice > filters.maxPrice) return false;
          return true;
        }).slice(0, 3);

        // Honesty Check
        if (suggestions.length === 0 && filters.city) {
            const city = filters.city;
            const prop = (filters.propType || "property").toLowerCase();
            const bhk = filters.bhk ? `${filters.bhk} BHK ` : "";
            filters.explanation = `Maaf kijiyega, mujhe ${city} mein aapke search ke regarding koi ${bhk}${prop} nahi mili. Aap criteria thoda change karke dekh sakte hain?`;
        }
        
        // Flatten photos
        suggestions = suggestions.map(p => ({
          ...p,
          photos: (p.photos || []).map((ph: any) => typeof ph === 'string' ? ph : ph.url).filter(Boolean)
        }));
      }

      return { success: true, filters, suggestions };

    } catch (error: any) {
      console.error("AI Search Error:", error);
      return { success: false, error: error.message };
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
    if (!apiKey) return { success: false, error: "AI key missing" };

    try {
      const messages = [
        { role: "system", content: "You are a real estate copywriter. Rewrite descriptions professionally. No intros, no markdown code blocks, ONLY the description." },
        { role: "user", content: args.text }
      ];

      const response = await fetch("https://api.sarvam.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey
        },
        body: JSON.stringify({
          model: "sarvam-m", // Fixed back to sarvam-m
          messages: messages
        })
      });

      const data = await response.json();
      // Defensive: API may return different shapes; guard against missing choices
      let aiResponse = "";
      try {
        if (Array.isArray(data?.choices) && data.choices.length > 0) {
          aiResponse = data.choices[0]?.message?.content || data.choices[0]?.text || "";
        } else if (typeof data?.message?.content === 'string') {
          aiResponse = data.message.content;
        } else if (typeof data?.output_text === 'string') {
          aiResponse = data.output_text;
        } else if (typeof data?.text === 'string') {
          aiResponse = data.text;
        } else {
          console.warn('Unexpected AI response shape:', Object.keys(data || {}));
          return { success: false, error: 'AI returned unexpected response format' };
        }
      } catch (e) {
        console.error('Error parsing AI response:', e, data);
        return { success: false, error: 'Failed to parse AI response' };
      }
      aiResponse = (aiResponse || "").replace(/<[^>]+>/gi, "").replace(/```[\s\S]*?```/g, "").trim();

      return { success: true, text: aiResponse };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});
