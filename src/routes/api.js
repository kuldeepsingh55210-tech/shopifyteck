const express = require('express');
const router = express.Router();
const db = require('../db/db');

// GET /api/tickets?shop_id=xxx
router.get('/tickets', async (req, res) => {
    const { shop_id } = req.query;
    if (!shop_id) return res.status(400).json({ error: 'shop_id required' });

    // Validate shop exists
    const shopCheck = await db.query('SELECT id FROM shops WHERE id = $1', [shop_id]);
    if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const result = await db.query(
        `SELECT id, customer_email, detected_intent, resolution_status,
         response_confidence, SUBSTRING(ai_response, 1, 100) as ai_response, created_at
         FROM tickets
         WHERE shop_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [shop_id]
    );

    res.json(result.rows);
});

// GET /api/shops?domain=xxx
router.get('/shops', async (req, res) => {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const result = await db.query('SELECT id, domain FROM shops WHERE domain = $1', [domain]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    res.json(result.rows[0]);
});

// GET /api/stats?shop_id=xxx
router.get('/stats', async (req, res) => {
    const { shop_id } = req.query;
    if (!shop_id) return res.status(400).json({ error: 'shop_id required' });

    const shopCheck = await db.query('SELECT id FROM shops WHERE id = $1', [shop_id]);
    if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const result = await db.query(
        `SELECT
            COUNT(*) as total_tickets,
            COUNT(*) FILTER (WHERE resolution_status = 'auto_resolved') as auto_resolved,
            COUNT(*) FILTER (WHERE resolution_status = 'escalated') as escalated,
            ROUND(COUNT(*) FILTER (WHERE resolution_status = 'auto_resolved') * 100.0 / NULLIF(COUNT(*), 0), 2) as automation_rate,
            ROUND(AVG(response_confidence)::numeric, 2) as avg_confidence
         FROM tickets
         WHERE shop_id = $1
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [shop_id]
    );

    res.json(result.rows[0]);
});

module.exports = router;