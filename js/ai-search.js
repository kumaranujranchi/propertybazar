import { convex } from "./convex.js";

// AI Search Assistant Logic
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('ai-assistant-root')) {
    initAISearchAssistant();
  }
});

function initAISearchAssistant() {
  // ... (bubble and drawer creation code) ...
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
        // Redirection logic remains the same
        const params = new URLSearchParams();
        if (filters.type) params.set('type', filters.type);
        if (filters.city) params.set('location', filters.city);
        if (filters.propType) params.set('propType', filters.propType);
        if (filters.bhk) params.set('bhk', filters.bhk);
        
        addMessage("Searching properties for you...", 'bot');
        setTimeout(() => {
            window.location.href = `properties.html?${params.toString()}`;
        }, 1500);
        return;
    }

    // Listing page update logic remains the same
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
    if (filters.city) {
        const locInput = document.getElementById('hero-location');
        if (locInput) locInput.value = filters.city;
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
