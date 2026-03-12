import { convex } from "./convex.js";

// AI Search Assistant Logic
document.addEventListener('DOMContentLoaded', () => {
  // Prevent creating multiple AI assistant instances if this script
  // is loaded more than once. Check for the bubble or drawer IDs.
  if (!document.getElementById('ai-bubble') && !document.getElementById('ai-chat-drawer')) {
    initAISearchAssistant();
  }
});

function initAISearchAssistant() {
  // 1. Create Floating Bubble
  const bubble = document.createElement('div');
  bubble.id = 'ai-bubble';
  bubble.className = 'ai-bubble';
  bubble.innerHTML = `
    <div class="ai-bubble-icon">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="ai-bubble-label">AI Search</div>
  `;
  document.body.appendChild(bubble);

  // 2. Create Chat Drawer
  const drawer = document.createElement('div');
  drawer.id = 'ai-chat-drawer';
  drawer.className = 'ai-chat-drawer';
  drawer.innerHTML = `
    <div class="ai-chat-header">
      <div class="ai-chat-title">
        <i class="fa-solid fa-robot" style="color:var(--primary)"></i>
        <span>24Dismil AI Assistant</span>
      </div>
      <button class="ai-chat-close">&times;</button>
    </div>
    <div class="ai-chat-messages" id="ai-chat-messages">
      <div class="ai-msg bot">
        Namaste! I can help you find your dream property. Aap kis bhasha mein baat karna pasand karenge? (Hindi / English / Hinglish)
        <div style="font-size:11px; margin-top:8px; opacity:0.7">Examples:<br>• "Patna mein 2bhk flat chahiye"<br>• "Commercial shop in Delhi under 1 Cr"</div>
        <a href="properties.html" class="btn btn-sm" style="margin-top:10px; opacity:0.8; font-size:10px; border:1px solid var(--border)">Use Manual Search instead</a>
      </div>
    </div>
    <div class="ai-chat-input-wrap">
      <input type="text" id="ai-chat-input" placeholder="Type your requirement in any language..." />
      <button id="ai-chat-send" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;
  document.body.appendChild(drawer);
  let chatHistory = [];

  // 3. Toggle Logic
  const closeBtn = drawer.querySelector('.ai-chat-close');
  const input = drawer.querySelector('#ai-chat-input');
  const sendBtn = drawer.querySelector('#ai-chat-send');
  const messages = drawer.querySelector('#ai-chat-messages');

  bubble.addEventListener('click', () => drawer.classList.add('open'));
  closeBtn.addEventListener('click', () => drawer.classList.remove('open'));

  // 4. Send Message Logic
  async function handleSendMessage() {
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';

    const typing = addMessage('Thinking...', 'bot', true);

    try {
      const result = await convex.action("ai:parseSearchQuery", { 
        query: text,
        history: chatHistory.slice(-6) // Keep last 3 turns
      });
      typing.remove();
      if (result.success && result.filters) {
        const filters = result.filters;
        const explanation = filters.explanation || "I've processed your request.";
        addMessage(explanation, 'bot');
        
        // --- NEW: Property Suggestions Rendering ---
        let suggestions = result.suggestions;

        if (suggestions && suggestions.length > 0) {
          renderPropertySuggestions(suggestions);
        }

        // Update history
        chatHistory.push({ role: "user", content: text });
        chatHistory.push({ role: "assistant", content: explanation });

        // Apply Filters (Only if search criteria found)
        if (filters.city || filters.bhk || filters.propType || filters.type) {
            applyAIFilters(filters);
        }
      } else {
        addMessage(result.error || "Sorry, I couldn't understand that. Please try again.", 'bot');
      }
    } catch (err) {
      typing.remove();
      addMessage("Connection error. Please try again later.", 'bot');
      console.error(err);
    }
  }

  function renderPropertySuggestions(suggestions) {
    const cardContainer = document.createElement('div');
    cardContainer.className = 'ai-property-suggestions';

    suggestions.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'ai-prop-card';
      card.dataset.id = prop._id;
      
      // Get the first photo URL or use a valid local placeholder
      let photoUrl = 'images/property-1.jpg'; // Better default than img/placeholder.jpg
      if (prop.photos && prop.photos.length > 0) {
        // Backend now flattens photos to URLs, but we check just in case
        photoUrl = typeof prop.photos[0] === 'string' ? prop.photos[0] : (prop.photos[0].url || photoUrl);
      }

      card.innerHTML = `
        <img src="${photoUrl}" alt="${prop.propertyType}">
        <div class="details">
          <div class="title">
            ${prop.details?.bhk ? prop.details.bhk + ' BHK ' : ''}${prop.propertyType} in ${prop.location?.locality || prop.location?.city}
          </div>
          <div class="price">
            ₹${formatPrice(prop.pricing?.expectedPrice)}
          </div>
        </div>
      `;
      card.onclick = () => window.open(`property-detail.html?id=${prop._id}`, '_blank');
      cardContainer.appendChild(card);
    });

    const botMessage = document.createElement('div');
    botMessage.className = 'ai-msg bot suggestion-container';
    botMessage.appendChild(cardContainer);
    messages.appendChild(botMessage);
    messages.scrollTop = messages.scrollHeight;
  }

  function formatPrice(price) {
    if (!price) return 'N/A';
    if (price >= 10000000) return (price / 10000000).toFixed(2) + ' Cr';
    if (price >= 100000) return (price / 100000).toFixed(2) + ' L';
    return price.toLocaleString('en-IN');
  }

  function addMessage(text, side, isTyping = false) {
    const msg = document.createElement('div');
    msg.className = `ai-msg ${side}`;
    if (isTyping) msg.classList.add('typing');
    // Sanitize and handle empty text
    const displayChat = text || (side === 'bot' ? "I've processed your request." : "");
    if (!displayChat && !isTyping) return null;
    
    msg.innerHTML = displayChat;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function applyAIFilters(filters) {
    const isListingPage = !!document.querySelector('.listings-grid');
    
    if (!isListingPage) {
        // Redirection logic with deduplication
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.city) params.set('location', filters.city);
        if (filters.propType) params.set('propType', filters.propType);
        if (filters.bhk) params.set('bhk', filters.bhk);
        
        const searchUrl = `properties.html?${params.toString()}`;
        
        // Remove previous "See All Results" links to avoid frustration
        messages.querySelectorAll('.ai-msg.bot.redirect-msg').forEach(m => m.remove());

        setTimeout(() => {
          const linkMsg = document.createElement('div');
          linkMsg.className = 'ai-msg bot redirect-msg';
          linkMsg.innerHTML = `You can see matching properties here: <a href="${searchUrl}" class="btn btn-sm btn-primary" style="margin-top:8px; display:inline-block">See All Results</a>`;
          messages.appendChild(linkMsg);
          messages.scrollTop = messages.scrollHeight;
        }, 1000);
        return;
    }

    // Listing page update logic remains the same
    if (filters.type) {
        const tabs = document.querySelectorAll('.search-tab');
        const targetType = filters.type.toLowerCase();
        tabs.forEach(t => t.classList.toggle('active', t.dataset.type === targetType));
    }
    if (filters.propType) {
        const targetProp = filters.propType.toLowerCase();
        document.querySelectorAll('.filter-chips[data-type="propType"] .filter-chip').forEach(c => {
            const val = (c.dataset.val || "").toLowerCase();
            c.classList.toggle('active', val === targetProp || (targetProp === 'plot' && val === 'land'));
        });
    }
    if (filters.bhk) {
        document.querySelectorAll('.filter-chips[data-type="bhk"] .filter-chip').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.val) === parseInt(filters.bhk));
        });
    }
    if (filters.city) {
        const locInputs = [document.getElementById('hero-location'), document.getElementById('hero-location-input')];
        locInputs.forEach(inp => { if (inp) inp.value = filters.city; });
        
        const url = new URL(window.location);
        url.searchParams.set('location', filters.city);
        window.history.pushState({}, '', url);
    }
    
    if (typeof window.filterProperties === 'function') {
        window.filterProperties();
    } else {
        window.renderFilteredProperties();
    }
  }

  sendBtn.addEventListener('click', handleSendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
}
