const db = require('../db/db');

const getOrCreateCustomer = async (shopDomain, customerEmail, customerName = null) => {
    try {
        console.log(`[Memory] Fetching customer ${customerEmail} for shop ${shopDomain}`);
        const result = await db.query(
            'SELECT * FROM customer_memory WHERE shop_domain = $1 AND customer_email = $2',
            [shopDomain, customerEmail]
        );

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        console.log(`[Memory] Creating new customer memory for ${customerEmail}`);
        const newCustomer = await db.query(
            `INSERT INTO customer_memory (shop_domain, customer_email, customer_name, total_orders, total_tickets, refund_request_count, refund_approved_count, sentiment_score, is_vip, language_preference)
             VALUES ($1, $2, $3, 0, 0, 0, 0, 0.5, false, 'english') RETURNING *`,
            [shopDomain, customerEmail, customerName || customerEmail.split('@')[0]]
        );
        return newCustomer.rows[0];
    } catch (error) {
        console.error('[Memory] Error in getOrCreateCustomer:', error.message);
        throw error;
    }
};

const updateCustomerAfterInteraction = async (shopDomain, customerEmail, updateData) => {
    try {
        console.log(`[Memory] Updating customer ${customerEmail} after interaction`);
        const { intent, sentiment, wasRefund, wasApproved, totalOrders } = updateData;

        // Get current customer to compute moving average
        const customer = await getOrCreateCustomer(shopDomain, customerEmail);

        let sentimentValue = 0.5; // neutral
        if (sentiment === 'positive') sentimentValue = 0.8;
        else if (sentiment === 'negative') sentimentValue = 0.2;
        else if (sentiment === 'angry') sentimentValue = 0.0;

        const newSentimentScore = (customer.sentiment_score * 0.7) + (sentimentValue * 0.3);

        const newTotalTickets = customer.total_tickets + 1;
        const newRefundRequests = intent === 'refund_request' ? customer.refund_request_count + 1 : customer.refund_request_count;
        const newRefundApproved = wasApproved ? customer.refund_approved_count + 1 : customer.refund_approved_count;
        
        // Ensure totalOrders is passed correctly, fallback to current
        const currentTotalOrders = totalOrders !== undefined ? totalOrders : customer.total_orders;

        const isVip = currentTotalOrders >= 5 || newTotalTickets >= 10;

        const result = await db.query(
            `UPDATE customer_memory 
             SET total_tickets = $1,
                 refund_request_count = $2,
                 refund_approved_count = $3,
                 sentiment_score = $4,
                 is_vip = $5,
                 total_orders = $6,
                 last_seen_at = NOW()
             WHERE shop_domain = $7 AND customer_email = $8
             RETURNING *`,
            [newTotalTickets, newRefundRequests, newRefundApproved, newSentimentScore, isVip, currentTotalOrders, shopDomain, customerEmail]
        );

        console.log(`[Memory] Updated stats: Tickets=${newTotalTickets}, Sentiment=${newSentimentScore.toFixed(2)}, VIP=${isVip}`);
        return result.rows[0];
    } catch (error) {
        console.error('[Memory] Error in updateCustomerAfterInteraction:', error.message);
        throw error;
    }
};

const saveConversation = async (shopDomain, customerEmail, message, intent, sentiment, resolution, aiResponse) => {
    try {
        console.log(`[Memory] Saving conversation history for ${customerEmail}`);
        const result = await db.query(
            `INSERT INTO conversation_history (shop_domain, customer_email, message, intent, sentiment, resolution, ai_response)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [shopDomain, customerEmail, message, intent, sentiment, resolution, aiResponse]
        );
        return result.rows[0];
    } catch (error) {
        console.error('[Memory] Error in saveConversation:', error.message);
        throw error;
    }
};

const getCustomerContext = async (shopDomain, customerEmail) => {
    try {
        const customer = await getOrCreateCustomer(shopDomain, customerEmail);

        const historyResult = await db.query(
            `SELECT message, intent, sentiment, resolution, created_at 
             FROM conversation_history 
             WHERE shop_domain = $1 AND customer_email = $2 
             ORDER BY created_at DESC 
             LIMIT 5`,
            [shopDomain, customerEmail]
        );

        let historySummary = 'No past interactions.';
        if (historyResult.rows.length > 0) {
            historySummary = historyResult.rows.map(row => 
                `- [${new Date(row.created_at).toISOString().split('T')[0]}] Msg: "${row.message}" -> Intent: ${row.intent}, Sentiment: ${row.sentiment}, Resolved: ${row.resolution}`
            ).join('\n');
        }

        const contextString = `CUSTOMER CONTEXT:
- Name: ${customer.customer_name}
- Total tickets raised: ${customer.total_tickets}
- Refund requests: ${customer.refund_request_count}
- VIP status: ${customer.is_vip}
- Sentiment history: ${customer.sentiment_score.toFixed(2)}/1.0
- Language preference: ${customer.language_preference}
- Past conversations summary:\n${historySummary}`;

        return contextString;
    } catch (error) {
        console.error('[Memory] Error in getCustomerContext:', error.message);
        return 'CUSTOMER CONTEXT: Error loading context.';
    }
};

const detectLanguagePreference = async (shopDomain, customerEmail, message) => {
    try {
        const hinglishKeywords = ['kya', 'hai', 'mera', 'order', 'kab', 'chahiye', 'refund', 'nahi', 'aaya', 'milega'];
        const devanagariRegex = /[\u0900-\u097F]/;
        
        let language = 'english';
        
        if (devanagariRegex.test(message)) {
            language = 'hinglish';
        } else {
            const words = message.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
            const hinglishWordCount = words.filter(word => hinglishKeywords.includes(word)).length;
            if (hinglishWordCount > 0) {
                language = 'hinglish';
            }
        }
        
        console.log(`[Memory] Detected language preference: ${language}`);

        await db.query(
            `UPDATE customer_memory SET language_preference = $1 WHERE shop_domain = $2 AND customer_email = $3`,
            [language, shopDomain, customerEmail]
        );

        return language;
    } catch (error) {
        console.error('[Memory] Error in detectLanguagePreference:', error.message);
        return 'english';
    }
};

module.exports = {
    getOrCreateCustomer,
    updateCustomerAfterInteraction,
    saveConversation,
    getCustomerContext,
    detectLanguagePreference
};
