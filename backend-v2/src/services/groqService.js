const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const generateGroqResponse = async (customerMessage, intent, ragContext, shopDomain) => {
  try {
    const systemPrompt = `You are ORYQX, an AI customer support agent for a Shopify store.
    
Your job is to help customers with their queries professionally and helpfully.

KNOWLEDGE BASE:
${ragContext || 'No specific knowledge base available.'}

RULES:
- Be friendly, professional and concise
- Answer in the same language as the customer
- If customer writes in Hindi/Hinglish, reply in Hinglish
- For order status queries without order number, ask for order number politely
- For general queries, give helpful answers from knowledge base
- Keep responses under 3 sentences
- Never make up information you don't have`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: customerMessage }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 200
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[Groq] Error:', error.message);
    return null;
  }
};

module.exports = { generateGroqResponse };
