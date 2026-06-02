const axios = require('axios');

const checkResponseConfidence = async (orderData, generatedResponse) => {
    try {
        const response = await Promise.race([
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.OPENAI_API_KEY}`,
                {
                    contents: [{
                        parts: [{
                            text: `Given this order data and this generated response, rate on a scale of 0-100 how well the response is supported by the order data only.
Return ONLY valid JSON: { "confidence_score": number, "reason": string }

Order Data: ${JSON.stringify(orderData)}
Generated Response: "${generatedResponse}"`
                        }]
                    }]
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);

        const text = response.data.candidates[0].content.parts[0].text;
        const clean = text.replace(/```json|```/g, '').trim();
        const result = JSON.parse(clean);

        return {
            ...result,
            should_escalate: result.confidence_score < 80
        };

    } catch (error) {
        console.error('Confidence guardrail error:', error.message);
        return { confidence_score: 0, reason: 'Error', should_escalate: true };
    }
};

module.exports = { checkResponseConfidence };