const axios = require('axios');

const generateResponse = async (orderData, customerMessage) => {
    try {
        const response = await Promise.race([
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.OPENAI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: `You are a helpful customer support agent for a Shopify store.
You will be given structured order data and a customer message.
Generate a friendly, concise response using ONLY the data provided.
DO NOT invent or assume any information not present in the order data.
If data is missing, say so honestly.

Order Data: ${JSON.stringify(orderData)}
Customer Message: "${customerMessage}"

Generate response:`
                        }]
                    }]
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);

        return response.data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error('Response generator error:', error.message);
        return null;
    }
};

module.exports = { generateResponse };