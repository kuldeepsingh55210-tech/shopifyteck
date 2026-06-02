const db = require('../db/db');
const { detectIntent } = require('../services/intentDetectionService');
const { getOrderData } = require('../services/orderLookupService');
const { generateResponse } = require('../services/responseGeneratorService');
const { checkResponseConfidence } = require('../services/confidenceGuardrailService');

const resolveOrder = async (req, res) => {
    const { shop_id, customer_message, order_number, customer_email } = req.body;

    // 1. Validate inputs
    if (!shop_id || !customer_message || !order_number || !customer_email) {
        return res.status(400).json({ error: 'All fields required: shop_id, customer_message, order_number, customer_email' });
    }

    // 2. Fetch shop from DB
    const shopResult = await db.query('SELECT * FROM shops WHERE id = $1 AND is_active = true', [shop_id]);
    if (shopResult.rows.length === 0) {
        return res.status(404).json({ error: 'Shop not found' });
    }
    const shop = shopResult.rows[0];

    // 3. Detect intent
    const intentResult = await detectIntent(customer_message);
    await logAction(null, 'INTENT_DETECTED', { intent: intentResult });

    // 4. Check intent and confidence
    if (intentResult.intent !== 'order_status' || intentResult.confidence < 0.7) {
        const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'escalated' });
        await logAction(ticket.id, 'ESCALATED', { reason: 'non_order_intent' });
        return res.json({ action: 'escalate', reason: 'non_order_intent' });
    }

    // 5. Get order data
    const orderData = await getOrderData(shop.shop_domain, shop.access_token, order_number, customer_email);
    if (!orderData.found) {
        const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'escalated' });
        await logAction(ticket.id, 'ESCALATED', { reason: 'order_not_found' });
        return res.json({ action: 'escalate', reason: 'order_not_found' });
    }

    // 6. Generate response
    const generatedResponse = await generateResponse(orderData, customer_message);

    // 7. Check confidence
    const confidenceResult = await checkResponseConfidence(orderData, generatedResponse);
    if (confidenceResult.should_escalate) {
        const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'escalated', ai_response: generatedResponse, response_confidence: confidenceResult.confidence_score });
        await logAction(ticket.id, 'ESCALATED', { reason: 'low_confidence' });
        return res.json({ action: 'escalate', reason: 'low_confidence' });
    }

    // 8. Auto resolve
    const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'auto_resolved', ai_response: generatedResponse, response_confidence: confidenceResult.confidence_score, resolved_at: new Date() });
    await logAction(ticket.id, 'AUTO_RESOLVED', { confidence: confidenceResult.confidence_score });

    return res.json({ action: 'respond', message: generatedResponse, confidence: confidenceResult.confidence_score });
};

// Helper: Save ticket
const saveTicket = async (data) => {
    const result = await db.query(
        `INSERT INTO tickets (shop_id, customer_email, order_number, raw_message, detected_intent, intent_confidence, resolution_status, ai_response, response_confidence, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [data.shop_id, data.customer_email, data.order_number, data.raw_message, data.detected_intent, data.intent_confidence, data.resolution_status, data.ai_response || null, data.response_confidence || null, data.resolved_at || null]
    );
    return result.rows[0];
};

// Helper: Log action
const logAction = async (ticketId, action, details) => {
    await db.query(
        `INSERT INTO automation_logs (ticket_id, action_taken, shopify_data_snapshot) VALUES ($1, $2, $3)`,
        [ticketId, action, JSON.stringify(details)]
    );
};

module.exports = { resolveOrder };