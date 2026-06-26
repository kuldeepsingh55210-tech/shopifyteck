const Groq = require('groq-sdk');
const rateLimiter = require('./rateLimiterService');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Track consecutive 429 rate limit errors globally at the module level
let consecutive429s = 0;

const generateGroqResponse = async (customerMessage, intent, ragContext, shopDomain, customPromptFlags = [], language = 'english', orderData = null) => {
  if (rateLimiter.isGlobalCooldown()) {
    console.warn('[Groq] Global rate limit cooldown active - skipping Groq call');
    return null;
  }

  let lastError = null;
  const maxRetries = 4; // 1 initial attempt + 3 retries (wait 2s, 4s, 8s)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let customInstructionsText = '';
      if (customPromptFlags && customPromptFlags.length > 0) {
        customInstructionsText = '\n\nCUSTOM INSTRUCTIONS & REASONING:\n' + customPromptFlags.map(f => `- ${f}`).join('\n');
      }

      // Requirement 2: Language-Matched Response Instructions
      let languageInstruction = '';
      if (language === 'hinglish') {
        languageInstruction = `You MUST reply in Hinglish (mix of Hindi and English). Use warm, friendly Indian tone. Example: 'Aapka order number share karein, main abhi check karta hoon!'`;
      } else {
        languageInstruction = `You MUST reply in professional English only. Example: 'Please share your order number so I can check the status for you.'`;
      }

      // Requirement 3: Intent Resolution Instructions
      let intentInstruction = '';
      switch (intent) {
        case 'greeting':
          intentInstruction = 'Welcome the customer warmly';
          break;
        case 'order_status':
          if (orderData) {
            intentInstruction = 'Show order status from data provided';
          } else {
            intentInstruction = 'Politely ask for order number';
          }
          break;
        case 'refund_request':
          intentInstruction = 'Check if eligible, explain process';
          break;
        case 'cancel_order':
          intentInstruction = 'Explain cancellation policy (24 hours)';
          break;
        case 'wrong_item':
          intentInstruction = 'Apologize, ask for order number and photo';
          break;
        case 'discount_issue':
          intentInstruction = 'Ask for coupon code, check common issues';
          break;
        case 'payment_issue':
          intentInstruction = 'Reassure money is safe, explain next steps';
          break;
        case 'size_query':
          intentInstruction = 'Ask for measurements, suggest size';
          break;
        case 'angry_customer':
          intentInstruction = 'Empathize, inform human agent coming';
          break;
        case 'general_inquiry':
          intentInstruction = 'Answer from knowledge base only';
          break;
        case 'unknown':
          intentInstruction = 'Politely ask to clarify the issue';
          break;
      }

      const orderDataText = orderData ? JSON.stringify(orderData, null, 2) : 'No order data available.';

      const systemPrompt = `You are ORYQX, an AI customer support agent for a Shopify store.
    
Your job is to help customers with their queries professionally and helpfully.

LANGUAGE CONFIGURATION:
${languageInstruction}

CRITICAL: Never mix response language. If customer wrote in Hinglish, your ENTIRE response must be in Hinglish. If customer wrote in English, your ENTIRE response must be in English.

INTENT RESOLUTION RULE:
Intent is: "${intent}".
Your task for this intent: ${intentInstruction}

KNOWLEDGE BASE:
${ragContext || 'No specific knowledge base available.'}

ORDER DATA:
${orderDataText}

RULES:
- Be friendly, professional and concise
- Keep responses under 3 sentences
- Never make up information you don't have${customInstructionsText}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: customerMessage }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 200
      });

      // Reset consecutive rate limits on any successful response
      consecutive429s = 0;
      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      lastError = error;
      const status = error.status || error.response?.status;
      console.warn(`[Groq] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

      if (status === 429) {
        consecutive429s++;
        if (consecutive429s >= 3) {
          console.error('[Groq] 3 consecutive 429 rate limit failures. Activating global cooldown.');
          rateLimiter.setGlobalCooldown(60);
          consecutive429s = 0; // Reset after activating cooldown to prevent loop
        }

        if (attempt < maxRetries) {
          const delays = [2000, 4000, 8000];
          const delay = delays[attempt - 1] || 8000;
          console.warn(`[Groq] Rate limit (429) hit. Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Non-429 error, fail immediately to trigger Gemini fallback
        console.error(`[Groq] Non-429 error encountered (${status}). Aborting retries.`);
        break;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
};

module.exports = { generateGroqResponse };

