const axios = require('axios');
const rateLimiter = require('./rateLimiterService');
const { generateFallbackResponse, getCannedResponse } = require('./fallbackResponseService');
const { generateGroqResponse } = require('./groqService');

const extractAnswerFromRagContext = (ragContext) => {
    if (!ragContext || typeof ragContext !== 'string') return null;
    
    const lines = ragContext.split(/\r?\n/);
    const answers = [];
    
    for (const line of lines) {
        if (line.trim().startsWith('A: ')) {
            const answer = line.trim().substring(3).trim();
            if (answer) {
                answers.push(answer);
            }
        }
    }
    
    if (answers.length === 0) return null;
    
    return answers.join(' ');
};

const generateResponse = async (orderData, customerMessage, intent = 'order_status', customPromptFlags = [], ragContext = '', shopDomain = '') => {
    try {
        console.log(`[Response] Generating response for order ${orderData?.order_number || 'Unknown'} and message: "${customerMessage.substring(0, 50)}..." (Intent: ${intent})`);

        // Validate inputs
        if ((!orderData || typeof orderData !== 'object') && !ragContext) {
            console.error('[Response] ERROR: Invalid order data provided');
            return generateFallbackResponse(orderData, customerMessage, intent);
        }

        if (!customerMessage || customerMessage.trim().length === 0) {
            console.error('[Response] ERROR: Empty customer message');
            return generateFallbackResponse(orderData, customerMessage, intent);
        }

        // EARLY RETURN FOR SIMPLE INTENTS
        if (intent === 'greeting') {
            return "Hi! Welcome to ORYQX Support. How can I help you today? 😊";
        }
        if (intent === 'unknown' || intent === 'random') {
            return "I'm not sure I understood that. Could you please describe your issue? For example: order status, returns, or shipping.";
        }
        if (intent === 'exchange_request') {
            return "We'd be happy to help you exchange your item! Please share your order number and reason for exchange.";
        }

        // Try Groq first (faster, no rate limits)
        console.log('[Response] Trying Groq API first...');
        const groqResponse = await generateGroqResponse(
            customerMessage, 
            intent, 
            ragContext, 
            shopDomain,
            customPromptFlags
        );
        if (groqResponse) {
            console.log('[Response] Groq API success!');
            return groqResponse;
        }
        console.log('[Response] Groq failed, falling back to Gemini...');

        console.log(`[Response] Calling Gemini API with retry logic...`);
        console.log(`[Response] Queue size: ${rateLimiter.getQueueSize()}, Pending: ${rateLimiter.getPendingCount()}`);

        let customInstructions = '';
        const ragPrefix = ragContext ? `${ragContext}\n\n--- END OF MERCHANT KNOWLEDGE BASE ---\n\n` : '';
        const orderDataText = orderData ? JSON.stringify(orderData, null, 2) : 'No order data available.';
        if (ragContext) {
            console.log('[Response] RAG context injected into prompt');
        }
        if (customPromptFlags && customPromptFlags.length > 0) {
            customInstructions = '\n\nCUSTOM INSTRUCTIONS & REASONING:\n' + customPromptFlags.map(f => `- ${f}`).join('\n');
        }

        const response = await rateLimiter.executeQueued(async () => {
            const apiResponse = await Promise.race([
                axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        contents: [{
                            parts: [{
                                text: `You are a helpful and professional customer support agent for a Shopify e-commerce store.
You will be given structured order data and a customer question or message.
Generate a friendly, concise, and helpful response using ONLY the data provided.

IMPORTANT RULES:
1. Only use information from the order data provided below.
2. Do NOT invent, assume, or hallucinate any information not in the order data.
3. If merchant-specific knowledge is provided, use it first for store policies and FAQs.
4. If data is missing, say so honestly (e.g., "Tracking info not yet available").
5. If the intent or reasoning requires it, strictly follow the provided Custom Instructions.
6. Keep response to 2-4 sentences max.
7. If the reasoning context specifies "Language: hinglish", respond using a warm, familiar tone in Hinglish (a mix of Hindi and English) commonly used in Indian e-commerce. If "Language: english", be professional but friendly and clear.${customInstructions}

${ragPrefix}Order Data:
${orderDataText}

Customer Message: "${customerMessage}"

Generate a helpful response:`
                            }]
                        }]
                    }
                ),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Response generation timeout')), 8000))
            ]);

            // Validate API response
            if (!apiResponse.data || !apiResponse.data.candidates || apiResponse.data.candidates.length === 0) {
                console.error('[Response] ERROR: Invalid Gemini API response structure');
                throw new Error('Invalid response structure from Gemini API');
            }

            const candidate = apiResponse.data.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                console.error('[Response] ERROR: No content in API response');
                throw new Error('No content in Gemini API response');
            }

            const generatedText = candidate.content.parts[0].text;

            // Validate response is not empty
            if (!generatedText || generatedText.trim().length === 0) {
                console.error('[Response] ERROR: Empty response from Gemini');
                throw new Error('Empty response from Gemini API');
            }

            return generatedText;
        });

        console.log(`[Response] SUCCESS - Generated response: "${response.substring(0, 100)}..."`);
        return response;

    } catch (error) {
        console.error(`[Response] EXCEPTION: ${error.message}`);
        console.error(`[Response] Error type: ${error.code || error.name}`);

        if (error.response?.status === 401) {
            console.error('[Response] CRITICAL: Gemini API authentication failed - check GEMINI_API_KEY');
        } else if (error.response?.status === 429) {
            console.error('[Response] Rate limit still exceeded after retries - using fallback response');
        } else if (error.message.includes('timeout')) {
            console.error('[Response] Generation timed out - using fallback response');
        }

        console.error('[Response] Full error:', error.message);
        console.log('[Response] Using fallback response...');

        if (shopDomain) {
            const canned = await getCannedResponse(shopDomain, intent);
            if (canned) {
                console.log(`[Canned] Using canned response for intent: ${intent}`);
                let formattedMessage = canned;
                if (orderData) {
                    const orderId = orderData.id || orderData.order_number || 'Unknown';
                    const status = orderData.fulfillment_status || 'processing';
                    const eta = 'soon';
                    
                    formattedMessage = formattedMessage
                        .replace(/{order_id}/g, orderId)
                        .replace(/{order_number}/g, orderId)
                        .replace(/{status}/g, status)
                        .replace(/{eta}/g, eta);
                }
                return formattedMessage;
            }
        }

        if (error.response?.status === 429 && ragContext && ragContext.trim()) {
            const ragFallback = extractAnswerFromRagContext(ragContext);
            if (ragFallback) {
                console.log('[Response] Gemini 429 detected and RAG context available - using RAG fallback response');
                return ragFallback;
            }
        }
        const fallback = generateFallbackResponse(orderData, customerMessage, intent);
        console.log(`[Response] Fallback response: "${fallback.substring(0, 100)}..."`);
        return fallback;
    }
};

module.exports = { generateResponse };