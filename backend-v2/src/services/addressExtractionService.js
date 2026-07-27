const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Pulls address fields out of a single free-text customer message like:
// "my new address is 123 MG Road, Indore, MP, 452001, phone 9876543210"
// Returns null on failure so the caller can fall back to asking the customer to resend it.
const extractAddress = async (customerMessage) => {
    try {
        const prompt = `Extract a shipping address from this customer message. Return ONLY valid JSON, no markdown, no explanation, no extra text.
Format exactly: {"address1": "string or null", "address2": "string or null", "city": "string or null", "province": "string or null", "zip": "string or null", "country": "string or null", "phone": "string or null"}
Rules:
- If a field is not clearly present in the message, use null for that field.
- Do not guess, invent, or infer values that are not stated.
- "address1" should be the street/house/building line only, not the full address.

Message: "${customerMessage}"`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            temperature: 0,
            max_tokens: 250
        });

        const raw = completion.choices[0]?.message?.content || '';
        const clean = raw
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        return JSON.parse(clean);
    } catch (error) {
        console.error(`[AddressExtraction] Failed: ${error.message}`);
        return null;
    }
};

// Minimum bar for "confident enough to act on automatically": street, city, and postal code.
// Province/country/phone are allowed to be missing and get backfilled from the existing order.
const isAddressComplete = (addr) => {
    if (!addr) return false;
    return !!(addr.address1 && addr.city && addr.zip);
};

module.exports = { extractAddress, isAddressComplete };
