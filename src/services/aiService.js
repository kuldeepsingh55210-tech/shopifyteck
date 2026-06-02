const axios = require('axios');

const detectIntent = async (message) => {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [{
                parts: [{
                    text: `Analyze this customer message and return JSON only:
                    Message: "${message}"
                    Return exactly this format:
                    {
                        "intent": "OrderStatus" or "RefundRequest" or "GeneralQuery",
                        "confidence": 0.0 to 1.0
                    }`
                }]
            }]
        }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
};

module.exports = { detectIntent };