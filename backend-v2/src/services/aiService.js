const axios = require('axios');
const rateLimiter = require('./rateLimiterService');

const detectIntent = async (message) => {
    try {
        const response = await rateLimiter.executeQueued(async () => {
            const apiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: `Analyze this customer message and return JSON only:
                    Message: "${message}"
                    Return exactly this format:
                    {
                        "intent": "order_status" or "refund_request" or "general_query",
                        "confidence": 0.0 to 1.0
                    }`
                        }]
                    }]
                },
                { timeout: 8000 }
            );

            const text = apiResponse.data.candidates[0].content.parts[0].text;
            const clean = text.replace(/```json|```/g, '').trim();
            return JSON.parse(clean);
        });

        console.log(`[Intent] Detected: ${response.intent} (confidence: ${response.confidence})`);
        return response;
    } catch (error) {
        console.error(`[Intent] Failed to detect intent: ${error.message}`);
        console.log('[Intent] Returning default intent: order_status with low confidence');

        return {
            intent: 'order_status',
            confidence: 0.5
        };
    }
};

module.exports = { detectIntent };