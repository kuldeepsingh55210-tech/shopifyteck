const db = require('../db/db');
const { detectIntent } = require('../services/aiService');

// Saare tickets lao
const getAllTickets = async (req, res) => {
    const result = await db.query('SELECT * FROM tickets ORDER BY created_at DESC');
    res.json(result.rows);
};

// Naya ticket banao
const createTicket = async (req, res) => {
    const { shop_id, customer_message } = req.body;

    // AI se intent detect karo
    const aiResult = await detectIntent(customer_message);

    const result = await db.query(
        'INSERT INTO tickets (shop_id, raw_message, detected_intent, intent_confidence, resolution_status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [shop_id, customer_message, aiResult.intent, aiResult.confidence, 'pending']
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
    const { id } = req.params;
    const { response } = req.body;
    const result = await db.query(
        'UPDATE tickets SET resolution_status = $1, ai_response = $2 WHERE id = $3 RETURNING *',
        ['resolved', response, id]
    );
    res.json(result.rows[0]);
};

module.exports = { getAllTickets, createTicket, resolveTicket };