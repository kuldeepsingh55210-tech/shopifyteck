import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
});

const intentPrompt = `You are an AI support agent for a Shopify store.
Analyze the following customer message and determine the primary intent.
Return ONLY a valid JSON object with the following structure:
{
  "intent": "OrderStatus" | "RefundRequest" | "ProductQuestion" | "Other",
  "confidenceScore": number (0.0 to 1.0)
}

Focus strictly on extracting the intent. If it's about order status or tracking, use "OrderStatus".`;

export interface IntentResult {
    intent: string;
    confidenceScore: number;
}

export const detectIntent = async (message: string): Promise<IntentResult> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${intentPrompt}\n\nCustomer Message: "${message}"`,
            config: {
                responseMimeType: 'application/json',
            }
        });

        const result = JSON.parse(response.text || '{}');
        return {
            intent: result.intent || 'Other',
            confidenceScore: typeof result.confidenceScore === 'number' ? result.confidenceScore : 0.0,
        };
    } catch (error) {
        console.error('Error in detectIntent:', error);
        return { intent: 'Other', confidenceScore: 0.0 };
    }
};
