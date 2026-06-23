const axios = require('axios');
const ragService = require('./ragService');

const detectIntent = async (customerMessage, customerContext = '', shopDomain = null, ragContext = '') => {
    try {
        console.log(`[Intent] Detecting intent for: "${customerMessage}"`);

        const defaultResult = { 
            intent: 'order_status', 
            confidence: 0.5, 
            sentiment: 'neutral', 
            urgency: 'low', 
            language: 'english',
            secondary_intent: null,
            buying_signal: false,
            escalation_hint: false
        };

        // Input validation
        if (!customerMessage || customerMessage.trim().length === 0) {
            console.warn('[Intent] Empty message provided, defaulting to order_status');
            return defaultResult;
        }

        // Quick local intent detection for common patterns - highly accurate and fast
        const message = customerMessage.toLowerCase();

        // GREETING DETECTION
        if (message.match(/^(hi|hello|hey|greetings|namaste|hola|salaam|howdy|hii|hiiii|heyy|sup)\b/) ||
            message.match(/\b(hi there|hello there|hey there)\b/)) {
            console.log('[Intent] Detected as greeting (local pattern match)');
            return { ...defaultResult, intent: 'greeting', confidence: 0.95, sentiment: 'positive', urgency: 'low' };
        }

        // ANGRY/FRUSTRATED DETECTION
        const angryPatterns = /\b(pathetic|refund now|terrible|worst|horrible|furious|disgusting|useless|angry|hate|damn|hell|garbage|trash|bs|unfair)\b/i;
        if (angryPatterns.test(message)) {
            console.log('[Intent] Detected as angry_customer (local pattern match)');
            return { ...defaultResult, intent: 'angry_customer', confidence: 0.9, sentiment: 'angry', urgency: 'high', escalation_hint: true };
        }

        if ((message.includes('refund') && message.includes('policy')) ||
            message.includes('policy') || message.includes('niyam') || message.includes('rules')) {
            console.log('[Intent] Detected as general_inquiry (policy question local pattern match)');
            return { ...defaultResult, intent: 'general_inquiry', confidence: 0.85 };
        }

        if (message.includes('tracking') || message.includes('shipped')) {
            console.log('[Intent] Detected as shipping_status (local pattern match)');
            return { ...defaultResult, intent: 'shipping_status', confidence: 0.95, urgency: 'medium' };
        }

        if (message.includes('where is my order') || message.includes('order status') || 
            message.includes('order kahan hai') || message.includes('status') ||
            message.includes('deliver') || message.includes('arrival') || message.includes('arrived') || 
            (message.includes('when') && message.includes('deliver'))) {
            console.log('[Intent] Detected as order_status (local pattern match)');
            return { ...defaultResult, intent: 'order_status', confidence: 0.95, urgency: 'medium' };
        }

        // EXCHANGE REQUEST - product return/exchange (NOT money refund)
        if (message.match(/\b(exchange|replace|send.*back|wrong.*item|defective|damage|damaged|broken)\b/i) &&
            !message.includes('refund') && !message.includes('money back')) {
            console.log('[Intent] Detected as exchange_request (local pattern match)');
            return { ...defaultResult, intent: 'exchange_request', confidence: 0.9, urgency: 'medium' };
        }

        // REFUND REQUEST - money back
        if (message.includes('refund') || message.includes('money back') || message.includes('reimburse') ||
            message.includes('compensation') || message.includes('return money')) {
            console.log('[Intent] Detected as refund_request (local pattern match)');
            return { ...defaultResult, intent: 'refund_request', confidence: 0.9, sentiment: 'negative', urgency: 'high', escalation_hint: true };
        }

        if (message.includes('shipping') || message.includes('size') || message.includes('fit') || message.includes('rate')) {
            console.log('[Intent] Detected as policy (local pattern match)');
            return { ...defaultResult, intent: 'general_inquiry', confidence: 0.85 };
        }

        // Fall back to API for ambiguous cases
        console.log('[Intent] No pattern match, calling Gemini API for classification');

        const rateLimiter = require('./rateLimiterService');
        if (rateLimiter.isGlobalCooldown()) {
            console.warn('[Intent] Global rate limit cooldown active - defaulting to order_status');
            return defaultResult;
        }

        const promptPrefix = `${ragContext ? ragContext + '\n\n--- END OF MERCHANT KNOWLEDGE BASE ---\n\n' : ''}${customerContext ? customerContext + '\n\n' : ''}`;
        if (ragContext) {
            console.log('[Intent] RAG context injected into prompt');
        }

        const promptText = `${promptPrefix}Classify this customer service message into ONE of these 15 intents:
1. order_status
2. shipping_status
3. refund_request
4. cancel_order
5. product_query
6. angry_customer
7. vip_customer
8. human_handoff
9. cod_verification
10. payment_issue
11. exchange_request
12. loyalty_inquiry
13. abandoned_cart
14. delivery_issue
15. general_inquiry

Use the context provided to better understand the customer's situation and intent.
Return ONLY valid JSON (no markdown):
{"intent": "order_status|shipping_status|refund_request|cancel_order|product_query|angry_customer|vip_customer|human_handoff|cod_verification|payment_issue|exchange_request|loyalty_inquiry|abandoned_cart|delivery_issue|general_inquiry", "confidence": 0.0-1.0, "sentiment": "positive|neutral|negative|angry", "urgency": "low|medium|high", "language": "english|hinglish", "secondary_intent": "null_or_string", "buying_signal": true_or_false, "escalation_hint": true_or_false}

Message: "${customerMessage}"`;

        const apiResponse = await Promise.race([
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: promptText
                        }]
                    }]
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Intent detection timeout')), 5000))
        ]);

        // Validate API response
        if (!apiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.warn('[Intent] Invalid API response, defaulting to order_status');
            return defaultResult;
        }

        const text = apiResponse.data.candidates[0].content.parts[0].text;
        console.log(`[Intent] Raw API response: "${text}"`);

        // Clean JSON
        const clean = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^```/g, '')
            .replace(/```$/g, '')
            .trim();

        // Parse with error handling
        let result;
        try {
            result = JSON.parse(clean);
        } catch (parseError) {
            console.warn(`[Intent] Failed to parse API response: ${parseError.message}`);
            console.log(`[Intent] Fallback: defaulting to general_inquiry`);
            return { ...defaultResult, intent: 'general_inquiry' };
        }

        // Validate result
        if (!result.intent || result.confidence === undefined) {
            console.warn('[Intent] Missing intent or confidence in API response');
            return { ...defaultResult, intent: 'general_inquiry' };
        }
        
        // Ensure all fields exist
        result.sentiment = result.sentiment || 'neutral';
        result.urgency = result.urgency || 'low';
        result.language = result.language || 'english';
        result.secondary_intent = result.secondary_intent || null;
        result.buying_signal = !!result.buying_signal;
        result.escalation_hint = !!result.escalation_hint;

        console.log(`[Intent] SUCCESS - Intent: ${result.intent}, Confidence: ${result.confidence}, Sentiment: ${result.sentiment}, Language: ${result.language}`);
        return result;

    } catch (error) {
        console.error(`[Intent] EXCEPTION: ${error.message}`);
        if (error.response?.status === 401) {
            console.error('[Intent] Gemini API auth failed - check GEMINI_API_KEY');
        } else if (error.response?.status === 429) {
            const rateLimiter = require('./rateLimiterService');
            rateLimiter.setGlobalCooldown(60);
            console.error('[Intent] 429 Rate limit hit - activating cooldown and defaulting to order_status');
        } else if (error.message.includes('timeout')) {
            console.error('[Intent] API timeout - defaulting to order_status');
        }
        return { 
            intent: 'order_status', 
            confidence: 0.5, 
            sentiment: 'neutral', 
            urgency: 'low', 
            language: 'english',
            secondary_intent: null,
            buying_signal: false,
            escalation_hint: false
        };
    }
};

module.exports = { detectIntent };