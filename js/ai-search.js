import { convex } from "./convex.js";

// AI Search Assistant Logic
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('ai-assistant-root')) {
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
        Namaste! I can help you find your dream property. How can I assist you today? 
        <div style="font-size:11px; margin-top:8px; opacity:0.7">Examples:<br>• "Patna mein 2bhk flat chahiye"<br>• "Commercial shop in Delhi under 1 Cr"</div>
      </div>
    </div>
    <div class="ai-chat-input-wrap">
      <input type="text" id="ai-chat-input" placeholder="Type your requirement in any language..." />
      <button id="ai-chat-send" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;
  document.body.appendChild(drawer);

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

    // Add user message
    addMessage(text, 'user');
    input.value = '';

    // Add typing indicator
    const typing = addMessage('Searching properties...', 'bot', true);

    try {
      const result = await convex.action("ai:parseSearchQuery", { query: text });
      typing.remove();

      if (result.success && result.filters) {
        const filters = result.filters;
        addMessage(filters.explanation || "I've updated the filters based on your request.", 'bot');
        
        // Apply Filters Globally
        applyAIFilters(filters);
      } else {
        addMessage(result.error || "Sorry, I couldn't understand that. Please try again.", 'bot');
      }
    } catch (err) {
      typing.remove();
      addMessage("Connection error. Please try again later.", 'bot');
      console.error(err);
    }
  }

  function addMessage(text, side, isTyping = false) {
    const msg = document.createElement('div');
    msg.className = `ai-msg ${side}`;
    if (isTyping) msg.classList.add('typing');
    msg.innerHTML = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function applyAIFilters(filters) {
    const isListingPage = !!document.querySelector('.listings-grid');
    
    if (!isListingPage) {
        // Build URL params and redirect
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.city) params.set('location', filters.city);
        if (filters.propType) params.set('propType', filters.propType);
        if (filters.bhk) params.set('bhk', filters.bhk);
        
        addMessage("Redirecting you to the results...", 'bot');
        setTimeout(() => {
            window.location.href = `properties.html?${params.toString()}`;
        }, 1500);
        return;
    }

    // Existing logic for listing page
    if (filters.type) {
        const tabs = document.querySelectorAll('.search-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.type === filters.type));
    }

    if (filters.propType) {
        document.querySelectorAll('.filter-chips[data-type="propType"] .filter-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.val === filters.propType);
        });
    }

    if (filters.bhk) {
        document.querySelectorAll('.filter-chips[data-type="bhk"] .filter-chip').forEach(c => {
            c.classList.toggle('active', parseInt(c.dataset.val) === filters.bhk);
        });
    }

    // Set location input if city is mentioned
    if (filters.city) {
        const locInput = document.getElementById('hero-location');
        if (locInput) locInput.value = filters.city;
        
        // Update URL for consistency (optional but good for reload)
        const url = new URL(window.location);
        url.searchParams.set('location', filters.city);
        window.history.pushState({}, '', url);
    }

    // Trigger Re-render via filterProperties to sync with DOM state
    if (typeof window.filterProperties === 'function') {
        window.filterProperties();
    } else {
        window.renderFilteredProperties();
    }
    
    // Auto-close on small screens or just give feedback
    if (window.innerWidth < 768) {
        setTimeout(() => drawer.classList.remove('open'), 2000);
    }
  }

  sendBtn.addEventListener('click', handleSendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
}
