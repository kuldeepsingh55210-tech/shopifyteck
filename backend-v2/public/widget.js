(function() {
  // Prevent duplicate script execution
  if (window.ORYQX_WIDGET) return;

  // 1. Get Merchant Shop Domain from the script tag attribute
  const scriptTag = document.currentScript;
  const shopDomain = scriptTag ? scriptTag.getAttribute('data-shop') : '';
  if (!shopDomain) {
    console.error('[ORYQX Widget] Error: data-shop attribute is required on the script tag.');
    return;
  }

  const cleanShopDomain = shopDomain.trim().replace(/^https?:\/\//, '');
  const API_URL = 'https://api.oryqx.com';
  const sessionKey = 'oryqx_chat_' + cleanShopDomain;
  let cachedShopId = null;

  // 2. Inject CSS Styles
  const style = document.createElement('style');
  style.textContent = `
    .oryqx-widget-container * {
      box-sizing: border-box;
      font-family: 'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .oryqx-launcher-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c6ef7, #06c6f5);
      box-shadow: 0 4px 20px rgba(124, 110, 247, 0.4);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
    }
    .oryqx-launcher-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(124, 110, 247, 0.6);
    }
    .oryqx-launcher-btn:active {
      transform: scale(0.95);
    }
    .oryqx-chat-window {
      position: fixed;
      bottom: 95px;
      right: 20px;
      width: 350px;
      height: 500px;
      background: rgba(10, 11, 15, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid #2A2D3E;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .oryqx-chat-window.oryqx-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .oryqx-chat-header {
      padding: 14px 16px;
      border-bottom: 1px solid #2A2D3E;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #121317;
    }
    .oryqx-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .oryqx-header-text {
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.02em;
    }
    .oryqx-status-dot {
      width: 8px;
      height: 8px;
      background-color: #00e29e;
      border-radius: 50%;
      position: relative;
    }
    .oryqx-status-dot::after {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background-color: #00e29e;
      border-radius: 50%;
      animation: oryqx-pulse 1.8s infinite ease-in-out;
    }
    @keyframes oryqx-pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    .oryqx-close-btn {
      background: transparent;
      border: none;
      color: #8B8FA8;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      transition: color 0.2s ease, background 0.2s ease;
    }
    .oryqx-close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .oryqx-chat-body {
      flex-grow: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .oryqx-msg-row {
      display: flex;
      flex-direction: column;
      max-width: 80%;
    }
    .oryqx-msg-row.oryqx-customer {
      align-self: flex-end;
    }
    .oryqx-msg-row.oryqx-ai {
      align-self: flex-start;
    }
    .oryqx-msg-sender {
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      font-weight: 700;
      color: #8B8FA8;
      margin-bottom: 3px;
      margin-left: 2px;
    }
    .oryqx-msg-bubble {
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.45;
    }
    .oryqx-customer .oryqx-msg-bubble {
      background: linear-gradient(135deg, #7c6ef7, #06c6f5);
      color: #0A0B0F;
      font-weight: 500;
      border-radius: 12px 12px 0 12px;
    }
    .oryqx-ai .oryqx-msg-bubble {
      background: #121317;
      border: 1px solid #2A2D3E;
      color: #e3e2e8;
      border-radius: 12px 12px 12px 0;
    }
    .oryqx-escalation-badge {
      align-self: flex-start;
      margin-top: 4px;
      font-size: 9px;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255, 77, 109, 0.1);
      color: #FF4D6D;
      border: 1px solid rgba(255, 77, 109, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .oryqx-identity-fields {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      border-top: 1px solid #2A2D3E;
      background: #0d0e12;
      transition: all 0.3s ease;
    }
    .oryqx-identity-input {
      flex: 1;
      background: #0A0B0F;
      border: 1px solid #2A2D3E;
      color: #333333;
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 6px;
      outline: none;
      transition: border-color 0.2s ease;
    }
    .oryqx-identity-input:focus {
      border-color: #7c6ef7;
    }
    .oryqx-chat-input-area {
      padding: 12px;
      border-top: 1px solid #2A2D3E;
      background: #121317;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .oryqx-chat-input {
      flex-grow: 1;
      background: #0A0B0F;
      border: 1px solid #2A2D3E;
      color: #333333;
      font-size: 13px;
      padding: 8px 14px;
      border-radius: 20px;
      outline: none;
      transition: border-color 0.2s ease;
    }
    .oryqx-chat-input:focus {
      border-color: #7c6ef7;
    }
    .oryqx-send-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c6ef7, #06c6f5);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .oryqx-send-btn:hover {
      transform: scale(1.05);
    }
    .oryqx-typing-indicator {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 4px 6px;
    }
    .oryqx-typing-dot {
      width: 6px;
      height: 6px;
      background-color: #8B8FA8;
      border-radius: 50%;
      display: inline-block;
      animation: oryqx-bounce 1.4s infinite ease-in-out both;
    }
    .oryqx-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .oryqx-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes oryqx-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }
    @media (max-width: 480px) {
      .oryqx-chat-window {
        bottom: 0;
        right: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
      }
      .oryqx-launcher-btn {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // 3. Create DOM Elements
  const container = document.createElement('div');
  container.className = 'oryqx-widget-container';

  // Launcher Button
  const launcher = document.createElement('button');
  launcher.className = 'oryqx-launcher-btn';
  launcher.title = 'Open Support Chat';
  launcher.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A0B0F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;

  // Chat Window
  const chatWindow = document.createElement('div');
  chatWindow.className = 'oryqx-chat-window';

  // Header
  const header = document.createElement('div');
  header.className = 'oryqx-chat-header';
  
  const titleContainer = document.createElement('div');
  titleContainer.className = 'oryqx-header-title';
  titleContainer.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
      <defs>
        <linearGradient id="widgetLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06c6f5" />
          <stop offset="100%" stop-color="#7c6ef7" />
        </linearGradient>
      </defs>
      <path d="M 35 40 A 15 15 0 0 1 65 40" fill="none" stroke="url(#widgetLogoGrad)" stroke-width="7" stroke-linecap="round"/>
      <path d="M 28 38 L 72 38 L 76 78 C 76 81, 74 83, 71 83 L 29 83 C 26 83, 24 81, 24 78 Z" fill="none" stroke="url(#widgetLogoGrad)" stroke-width="7" stroke-linejoin="round"/>
    </svg>
    <span class="oryqx-header-text">ORYQX Support</span>
    <span class="oryqx-status-dot"></span>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'oryqx-close-btn';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close Chat';

  header.appendChild(titleContainer);
  header.appendChild(closeBtn);

  // Chat Body
  const chatBody = document.createElement('div');
  chatBody.className = 'oryqx-chat-body';

  // Identity inputs (Email / Order Number optional)
  const identityFields = document.createElement('div');
  identityFields.className = 'oryqx-identity-fields';
  
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'oryqx-identity-input';
  emailInput.placeholder = 'Email (optional)';
  emailInput.value = localStorage.getItem('oryqx_customer_email') || '';

  const orderInput = document.createElement('input');
  orderInput.type = 'text';
  orderInput.className = 'oryqx-identity-input';
  orderInput.placeholder = 'Order # (optional)';
  orderInput.value = localStorage.getItem('oryqx_order_number') || '';

  identityFields.appendChild(emailInput);
  identityFields.appendChild(orderInput);

  // Chat Input Area
  const inputArea = document.createElement('div');
  inputArea.className = 'oryqx-chat-input-area';

  const messageInput = document.createElement('input');
  messageInput.type = 'text';
  messageInput.className = 'oryqx-chat-input';
  messageInput.placeholder = 'Type your message...';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'oryqx-send-btn';
  sendBtn.title = 'Send Message';
  sendBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0B0F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  `;

  inputArea.appendChild(messageInput);
  inputArea.appendChild(sendBtn);

  chatWindow.appendChild(header);
  chatWindow.appendChild(chatBody);
  chatWindow.appendChild(identityFields);
  chatWindow.appendChild(inputArea);

  container.appendChild(launcher);
  container.appendChild(chatWindow);
  document.body.appendChild(container);

  // 4. Conversation State & Logic
  let messages = [];

  function saveSession() {
    sessionStorage.setItem(sessionKey, JSON.stringify(messages));
    // Persist email & order for convenience
    localStorage.setItem('oryqx_customer_email', emailInput.value);
    localStorage.setItem('oryqx_order_number', orderInput.value);
  }

  function appendMessage(sender, text, escalated = false) {
    const row = document.createElement('div');
    row.className = 'oryqx-msg-row oryqx-' + sender;

    const label = document.createElement('span');
    label.className = 'oryqx-msg-sender';
    label.textContent = sender === 'customer' ? 'You' : 'ORYQX AI';
    row.appendChild(label);

    const bubble = document.createElement('div');
    bubble.className = 'oryqx-msg-bubble';
    let messageText = text;
    if (sender === 'customer') {
      messageText = messageText.replace(/^["']|["']$/g, '').trim();
    }
    bubble.textContent = messageText; // Prevent XSS by using textContent
    row.appendChild(bubble);

    if (escalated) {
      const badge = document.createElement('span');
      badge.className = 'oryqx-escalation-badge';
      badge.textContent = '🚨 Escalated to human support';
      row.appendChild(badge);
    }

    chatBody.appendChild(row);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'oryqx-msg-row oryqx-ai oryqx-typing-indicator-row';
    
    const label = document.createElement('span');
    label.className = 'oryqx-msg-sender';
    label.textContent = 'ORYQX AI';
    indicator.appendChild(label);

    const bubble = document.createElement('div');
    bubble.className = 'oryqx-msg-bubble';
    bubble.innerHTML = `
      <div class="oryqx-typing-indicator">
        <span class="oryqx-typing-dot"></span>
        <span class="oryqx-typing-dot"></span>
        <span class="oryqx-typing-dot"></span>
      </div>
    `;
    indicator.appendChild(bubble);
    chatBody.appendChild(indicator);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = chatBody.querySelector('.oryqx-typing-indicator-row');
    if (indicator) {
      indicator.remove();
    }
  }

  // Fetch shop_id from Shopify Domain
  async function getShopId() {
    if (cachedShopId) return cachedShopId;
    try {
      const res = await fetch(`${API_URL}/api/shops?domain=${encodeURIComponent(cleanShopDomain)}`);
      if (!res.ok) throw new Error('Shop lookup failed');
      const data = await res.json();
      cachedShopId = data.id;
      return cachedShopId;
    } catch (e) {
      console.error('[ORYQX Widget] Error resolving shop ID:', e);
      return null;
    }
  }

  async function handleSend() {
    let text = messageInput.value.trim();
    if (!text) return;

    // Strip quotes from message BEFORE sending to backend API
    text = text.replace(/^["']|["']$/g, '').trim();
    if (!text) return;

    messageInput.value = '';
    appendMessage('customer', text);
    messages.push({ sender: 'customer', text: text });
    saveSession();

    showTypingIndicator();

    const shopId = await getShopId();
    if (!shopId) {
      removeTypingIndicator();
      appendMessage('ai', "Sorry, I'm having trouble connecting to this shop. Please verify that the ORYQX application is installed correctly.");
      return;
    }

    const payload = {
      shop_id: shopId,
      customer_message: text,
      customer_email: emailInput.value.trim(),
      order_number: orderInput.value.trim()
    };

    try {
      const res = await fetch(`${API_URL}/resolve-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      removeTypingIndicator();

      if (!res.ok) throw new Error('API resolution failed');
      const data = await res.json();
      
      const aiReply = data.response || 'I have logged your request.';
      const escalated = data.resolution === 'escalated' || data.escalated === true;
      
      appendMessage('ai', aiReply, escalated);
      messages.push({ sender: 'ai', text: aiReply, escalated: escalated });
      saveSession();
    } catch (err) {
      console.error('[ORYQX Widget] Error resolved order:', err);
      removeTypingIndicator();
      appendMessage('ai', "Sorry, I'm having trouble connecting. Please try again or contact support directly.");
    }
  }

  // Initialize from Session Storage
  const savedHistory = sessionStorage.getItem(sessionKey);
  if (savedHistory) {
    try {
      messages = JSON.parse(savedHistory);
      messages.forEach(msg => appendMessage(msg.sender, msg.text, msg.escalated));
    } catch (e) {
      messages = [];
    }
  }

  if (messages.length === 0) {
    const greeting = "Hi! 👋 I'm here to help with your order. Ask me anything about shipping, refunds, or your order status.";
    appendMessage('ai', greeting);
    messages.push({ sender: 'ai', text: greeting });
    saveSession();
  }

  // 5. Setup Action Listeners
  launcher.addEventListener('click', () => {
    chatWindow.classList.toggle('oryqx-open');
  });

  closeBtn.addEventListener('click', () => {
    chatWindow.classList.remove('oryqx-open');
  });

  sendBtn.addEventListener('click', handleSend);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // 6. Expose Programmatic API
  window.ORYQX_WIDGET = {
    open: function() {
      chatWindow.classList.add('oryqx-open');
    },
    close: function() {
      chatWindow.classList.remove('oryqx-open');
    }
  };
})();
