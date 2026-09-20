const db = require('../db/db');
const { detectIntent } = require('../services/aiService');

// Saare tickets lao
const getAllTickets = async (req, res) => {
    const shopId = req.shop?.id;
    if (!shopId) {
        return res.status(401).json({ error: 'Unauthorized: Missing authenticated shop context' });
    }

    const result = await db.query(
        'SELECT * FROM tickets WHERE shop_id = $1 ORDER BY created_at DESC',
        [shopId]
    );
    res.json(result.rows);
};

// Naya ticket banao
const createTicket = async (req, res) => {
    const shopId = req.shop?.id;
    if (!shopId) {
        return res.status(401).json({ error: 'Unauthorized: Missing authenticated shop context' });
    }

    const { customer_message } = req.body;

    // AI se intent detect karo
    const aiResult = await detectIntent(customer_message);

    const result = await db.query(
        'INSERT INTO tickets (shop_id, raw_message, detected_intent, intent_confidence, resolution_status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [shopId, customer_message, aiResult.intent, aiResult.confidence, 'pending']
    );

    // Automation log save karo
    try {
        await db.query(
            'INSERT INTO automation_logs (ticket_id, action, details) VALUES ($1, $2, $3)',
            [result.rows[0].id, 'AI_DETECTION', JSON.stringify(aiResult)]
        );
    } catch (error) {
        console.error('[Log] Failed to write automation log:', error.message);
        // Do not rethrow — logging failure should never crash the main request
    }

    res.json(result.rows[0]);
};

// Ticket resolve karo
const resolveTicket = async (req, res) => {
    const shopId = req.shop?.id;
    if (!shopId) {
        return res.status(401).json({ error: 'Unauthorized: Missing authenticated shop context' });
    }

    const { id } = req.params;
    const { response } = req.body;
    const result = await db.query(
        'UPDATE tickets SET resolution_status = $1, ai_response = $2 WHERE id = $3 AND shop_id = $4 RETURNING *',
        ['resolved', response, id, shopId]
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(result.rows[0]);
};

module.exports = { getAllTickets, createTicket, resolveTicket };