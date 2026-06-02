import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const query = `
      SELECT 
        t.id, t.shop_id, t.customer_email, t.raw_message AS body, 
        t.detected_intent AS intent, t.intent_confidence AS confidenceScore, 
        UPPER(t.resolution_status::text) AS status, t.created_at AS createdAt,
        s.shop_domain as shopifyTicketId
      FROM tickets t
      LEFT JOIN shops s ON t.shop_id = s.id
      ORDER BY t.created_at DESC
      LIMIT 50;
    `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

export default router;
