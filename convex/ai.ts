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
      const s = str.toLowerCase();
      const t = target.toLowerCase();
      if (s.includes(t) || t.includes(s)) return true;
      
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
    
    // 1. Extract Property Type via strict keywords
    if (/\b(flat|apartment|2bhk|3bhk|1bhk|bhk)\b/i.test(userText)) scannedFilters.propType = "Apartment";
    else if (/\b(plot|land|zamin|bhukhand)\b/i.test(userText)) scannedFilters.propType = "Plot";
    else if (/\b(villa|bungalow|house|makan|kothi)\b/i.test(userText)) scannedFilters.propType = "Villa";
    else if (/\b(shop|office|retail|commercial|dukan)\b/i.test(userText)) scannedFilters.propType = "Commercial";

    // 2. Extract City via Database Lookup + Fuzzy Matching
    // @ts-ignore
    const { api } = await import("./_generated/api");
    const allCities = await ctx.runQuery(api.properties.getUniqueCities);
    for (const city of allCities) {
        if (userText.includes(city.toLowerCase()) || fuzzyMatch(userText, city)) {
            scannedFilters.city = city;
            break;
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
2. General Chat: If the user asks general questions, says thanks, or just chats (e.g., "how are you?"), respond warmly in the "explanation" field and keep filters empty.
3. Language: Always mirror the user's language (Hindi/English/Hinglish).

SEARCH CRITERIA TO EXTRACT:
- "city": string (e.g. "Patna", "Delhi")
- "type": "Rent" or "Sale"
- "propType": "Apartment", "Villa", "Plot", "Commercial", "PG"
- "bhk": string (e.g. "2", "3")
- "maxPrice": number (total budget in Rupees)
- "explanation": A warm, human, conversational message.

RULES:
- ALREADY EXTRACTED: ${JSON.stringify(scannedFilters)}. Prioritize these.
- If the user is closing the conversation (e.g., "ok thanks", "nice"), simply respond politely and do NOT ask search questions.
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
          model: "sarvam-m", // Fixed back to sarvam-m
          messages: messages,
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (response.ok) {
        const data = await response.json();
        let aiResponse = data.choices[0]?.message?.content || "";

        // Handle Reasoning Blocks
        aiResponse = aiResponse.replace(/<(think|thought)>[\s\S]*?<\/\1>/gi, "").replace(/<(?:think|thought)>[\s\S]*/gi, "").trim();

        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                filters = JSON.parse(jsonMatch[0].trim());
                aiExplanation = filters.explanation || "";
            } catch (e) {
                console.warn("AI JSON parse failed", e);
            }
        }
      } else {
        console.warn(`AI API error: ${response.status}. Falling back to Keyword Scanner.`);
      }
    } catch (e) {
      console.warn("AI AI call failed. Falling back to Keyword Scanner.", e);
    }

    // --- MERGE SCANNED FILTERS WITH AI FILTERS ---
    filters = { ...filters, ...scannedFilters };

    // Ensure explanation exists - HUMANIZATION ENGINE (Resilient to AI failure)
    const isGreeting = /^(hi|hello|hey|hei|namaste|morning|evening|heya|yo|hlo|hii|hiii)$/i.test(userText);
    const isStatus = /^(ok|okay|nice|good|fine|waht|what|ji|thik|theek|perfect|great|done|over|thanks|thank you|ty|shukriya|dhanyawad)$/i.test(userText);
    
    if (!aiExplanation || aiExplanation.trim() === "" || aiExplanation.includes("analyzed your search criteria")) {
        if (isGreeting) {
            filters.explanation = "Namaste! I'm 24Dismil Ai Assitance, your property assistant. Aap kaise hain? How can I help you find a property today?";
        } else if (filters.city || filters.propType) {
            const city = filters.city || "this city";
            const propType = filters.propType || "property";
            const bhk = filters.bhk ? `${filters.bhk} BHK ` : "";
            filters.explanation = `Ji, main aapke liye ${city} mein ${bhk}${propType} check kar raha hoon...`;
        } else if (isStatus) {
            filters.explanation = "Ji bilkul! Iske alawa agar koi aur specific requirement ho (jaise budget ya locality), to zaroor batayein. I'm here to help!";
        } else {
            filters.explanation = "I understand. To help you better, could you tell me which city and what type of property (Flat, Villa, or Plot) you are looking for?";
        }
    } else {
        filters.explanation = aiExplanation;
    }

      // --- Smart Property Suggestions ---
      let suggestions: any[] = [];
      const hasMinimumCriteria = filters.city && (filters.propType || filters.bhk || filters.maxPrice || filters.type);
      
      if (hasMinimumCriteria) {
        // Fetch properties matching the criteria
        let properties = await ctx.runQuery(api.properties.getProperties, { 
          transactionType: filters.type 
        });

        // Smart Filtering logic
        suggestions = properties.filter((p: any) => {
          // City/Locality match
          if (filters.city) {
            const searchCity = filters.city.toLowerCase();
            const pCity = (p.location?.city || "").toLowerCase();
            const pLocality = (p.location?.locality || "").toLowerCase();
            const cityMatch = pCity && (userText.includes(pCity) || pCity.includes(searchCity) || fuzzyMatch(pCity, searchCity));
            const localityMatch = pLocality && (userText.includes(pLocality) || pLocality.includes(searchCity) || fuzzyMatch(pLocality, searchCity));
            if (!cityMatch && !localityMatch) return false;
          }
          
          // Property Type match
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
          // BHK match
          if (filters.bhk && parseInt(p.details?.bhk) !== parseInt(filters.bhk)) return false;
          // Price match
          if (filters.maxPrice && p.pricing?.expectedPrice > filters.maxPrice) return false;

          return true;
        }).slice(0, 3);

        // Flatten photos
        suggestions = suggestions.map(p => ({
          ...p,
          photos: (p.photos || []).map((ph: any) => typeof ph === 'string' ? ph : ph.url).filter(Boolean)
        }));

        // Honesty Check
        if (suggestions.length === 0) {
            const city = filters.city || "is area";
            const prop = (filters.propType || "property").toLowerCase();
            const bhk = filters.bhk ? `${filters.bhk} BHK ` : "";
            filters.explanation = `Maaf kijiyega, mujhe ${city} mein aapke search ke regarding koi ${bhk}${prop} nahi mili. Aap criteria thoda change karke dekh sakte hain?`;
            // Keep filters so user knows we tried
        }
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
      let aiResponse = data.choices[0]?.message?.content || "";
      aiResponse = aiResponse.replace(/<[^>]+>/gi, "").replace(/```[\s\S]*?```/g, "").trim();

      return { success: true, text: aiResponse };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
});
