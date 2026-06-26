const axios = require('axios');
const ragService = require('./ragService');

const detectIntent = async (customerMessage, customerContext = '', shopDomain = null, ragContext = '') => {
    try {
        console.log(`[Intent] Detecting intent for: "${customerMessage}"`);

        // Requirement 1: Detect customer language from message
        const isHinglish = /\b(mera|kaha|kab|aayega|chahiye|nahi|hai|hoon|karo|wapas|paisa|order)\b/i.test(customerMessage);
        const detectedLanguage = isHinglish ? 'hinglish' : 'english';

        const defaultResult = { 
            intent: 'order_status', 
            confidence: 0.5, 
            sentiment: 'neutral', 
            urgency: 'low', 
            language: detectedLanguage,
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
        const angryPatterns = /\b(pathetic|refund now|terrible|worst|horrible|furious|disgusting|useless|angry|hate|damn|garbage|trash|bs|unfair)\b/i;
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
            (message.includes('when') && message.includes('deliver')) ||
            message.includes('mera order kab aayega') || message.includes('order track karo') ||
            message.includes('delivery kab hogi') || message.includes('mera parcel kahan hai') ||
            message.includes('shipment kab aayega') || message.includes('order abhi tak nahi aaya') ||
            message.includes('kitne din lagenge')) {
            console.log('[Intent] Detected as order_status (local pattern match)');
            return { ...defaultResult, intent: 'order_status', confidence: 0.95, urgency: 'medium' };
        }

        // WRONG ITEM
        if (message.includes('wrong item') || message.includes('incorrect item') || 
            message.includes('wrong product') || message.includes('galat item')) {
            console.log('[Intent] Detected as wrong_item (local pattern match)');
            return { ...defaultResult, intent: 'wrong_item', confidence: 0.95 };
        }

        // CANCEL ORDER
        if (message.match(/\bcancel\b/) || message.includes('cancel order') || 
            message.includes('cancel my order') || message.includes('order cancel karo') ||
            message.includes('order band karo') || message.includes('mujhe order nahi chahiye')) {
            console.log('[Intent] Detected as cancel_order (local pattern match)');
            return { ...defaultResult, intent: 'cancel_order', confidence: 0.95 };
        }

        // DISCOUNT ISSUE
        if (message.includes('coupon') || message.includes('discount') || 
            message.includes('promo code') || message.includes('code not working') || 
            message.includes('coupon invalid')) {
            console.log('[Intent] Detected as discount_issue (local pattern match)');
            return { ...defaultResult, intent: 'discount_issue', confidence: 0.95 };
        }

        // PAYMENT ISSUE
        if (message.includes('payment failed') || message.includes('payment not working') || 
            message.includes('transaction failed') || message.includes('amount deducted') || 
            message.includes('charged twice')) {
            console.log('[Intent] Detected as payment_issue (local pattern match)');
            return { ...defaultResult, intent: 'payment_issue', confidence: 0.95, urgency: 'medium' };
        }

        // SIZE QUERY
        if (message.includes('size') || message.includes('sizing') || 
            message.includes('which size') || message.includes('size guide') || 
            message.includes('measurements') || message.match(/\b(fit|fits)\b/)) {
            console.log('[Intent] Detected as size_query (local pattern match)');
            return { ...defaultResult, intent: 'size_query', confidence: 0.95 };
        }

        // EXCHANGE REQUEST - product return/exchange (NOT money refund)
        if (message.match(/\b(exchange|replace|send.*back|defective|damage|damaged|broken)\b/i) &&
            !message.includes('refund') && !message.includes('money back')) {
            console.log('[Intent] Detected as exchange_request (local pattern match)');
            return { ...defaultResult, intent: 'exchange_request', confidence: 0.9, urgency: 'medium' };
        }

        // REFUND REQUEST - money back
        if (message.includes('refund') || message.includes('money back') || message.includes('reimburse') ||
            message.includes('compensation') || message.includes('return money') ||
            message.includes('paisa wapas karo') || message.includes('refund chahiye') ||
            message.includes('mera paisa wapas do') || message.includes('paise return karo')) {
            console.log('[Intent] Detected as refund_request (local pattern match)');
            return { ...defaultResult, intent: 'refund_request', confidence: 0.9, sentiment: 'negative', urgency: 'high', escalation_hint: true };
        }

        if (message.includes('shipping') || message.includes('rate')) {
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

        const promptText = `${promptPrefix}Classify this customer service message into ONE of these 18 intents:
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
16. wrong_item
17. discount_issue
18. size_query

Use the context provided to better understand the customer's situation and intent.
Return ONLY valid JSON (no markdown):
{"intent": "order_status|shipping_status|refund_request|cancel_order|product_query|angry_customer|vip_customer|human_handoff|cod_verification|payment_issue|exchange_request|loyalty_inquiry|abandoned_cart|delivery_issue|general_inquiry|wrong_item|discount_issue|size_query", "confidence": 0.0-1.0, "sentiment": "positive|neutral|negative|angry", "urgency": "low|medium|high", "language": "english|hinglish", "secondary_intent": "null_or_string", "buying_signal": true_or_false, "escalation_hint": true_or_false}

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
        result.language = detectedLanguage;
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
        
        const isHinglishFallback = /\b(mera|kaha|kab|aayega|chahiye|nahi|hai|hoon|karo|wapas|paisa|order)\b/i.test(customerMessage);
        const detectedLanguageFallback = isHinglishFallback ? 'hinglish' : 'english';
        
        return { 
            intent: 'order_status', 
            confidence: 0.5, 
            sentiment: 'neutral', 
            urgency: 'low', 
            language: detectedLanguageFallback,
            secondary_intent: null,
            buying_signal: false,
            escalation_hint: false
        };
    }
};

module.exports = { detectIntent };