const axios = require('axios');

const detectIntent = async (customerMessage) => {
    try {
        const response = await Promise.race([
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.OPENAI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: `You are a customer support intent classifier for e-commerce stores.
Classify the user message into exactly one of these intents: order_status, refund, policy, other.
Return ONLY valid JSON: { "intent": string, "confidence": float between 0 and 1 }

Customer message: "${customerMessage}"`
                        }]
                    }]
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);

        const text = response.data.candidates[0].content.parts[0].text;
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);

    } catch (error) {
        console.error('Intent detection error:', error.message);
        return { intent: 'other', confidence: 0 };
    }
};

module.exports = { detectIntent };