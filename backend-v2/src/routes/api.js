const express = require('express');
const router = express.Router();
const db = require('../db/db');
const merchantController = require('../controllers/merchantController');
const ragService = require('../services/ragService');
const verifyShop = require('../middleware/verifyShop');

// GET /api/shops - Get current shop by domain (passed as query param)
// Used by frontend after OAuth redirect to get shop_id
router.get('/shops', async (req, res) => {
    const { domain } = req.query;

    // If no domain provided, return error
    if (!domain) {
        return res.status(400).json({ error: 'domain query parameter required' });
    }

    try {
        const result = await db.query(
            'SELECT id, shop_domain, is_active, created_at FROM shops WHERE shop_domain = $1',
            [domain]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const shop = result.rows[0];
        res.json({
            id: shop.id,
            domain: shop.shop_domain,
            is_active: shop.is_active,
            created_at: shop.created_at
        });

    } catch (error) {
        console.error('Error fetching shop:', error.message);
        res.status(500).json({ error: 'Failed to fetch shop' });
    }
});

// Apply auth middleware to all routes below this line (handled globally in index.js)
// router.use(verifyShop);

// GET /api/tickets?shop_id=xxx
router.get('/tickets', async (req, res) => {
    const { shop_id } = req.query;
    if (!shop_id) return res.status(400).json({ error: 'shop_id required' });

    const shopCheck = await db.query('SELECT id FROM shops WHERE id = $1', [shop_id]);
    if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

    const result = await db.query(
        `SELECT id, customer_email, detected_intent, resolution_status, 
         response_confidence, LEFT(ai_response, 100) as ai_response, created_at 
         FROM tickets 
         WHERE shop_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [shop_id]
    );

    res.json(result.rows);
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
// GET /api/customer-memory/:email?shop_domain=xxx
router.get('/customer-memory/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query('SELECT * FROM customer_memory WHERE shop_domain = $1 AND customer_email = $2', [shop_domain, email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer memory not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching customer memory:', error.message);
        res.status(500).json({ error: 'Failed to fetch customer memory' });
    }
});

// GET /api/conversation-history/:email?shop_domain=xxx
router.get('/conversation-history/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            'SELECT * FROM conversation_history WHERE shop_domain = $1 AND customer_email = $2 ORDER BY created_at DESC LIMIT 20', 
            [shop_domain, email]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching conversation history:', error.message);
        res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
});

// GET /api/reasoning-logs/:email?shop_domain=xxx
router.get('/reasoning-logs/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            'SELECT * FROM reasoning_logs WHERE shop_domain = $1 AND customer_email = $2 ORDER BY created_at DESC LIMIT 10', 
            [shop_domain, email]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching reasoning logs:', error.message);
        res.status(500).json({ error: 'Failed to fetch reasoning logs' });
    }
});

// GET /api/escalated-tickets?shop_id=xxx
router.get('/escalated-tickets', async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });
        
        const result = await db.query(
            `SELECT t.*, c.customer_name, c.sentiment_score 
             FROM tickets t
             LEFT JOIN shops s ON t.shop_id = s.id
             LEFT JOIN customer_memory c ON c.customer_email = t.customer_email AND c.shop_domain = s.shop_domain
             WHERE t.shop_id = $1 AND t.resolution_status = 'escalated'
             ORDER BY t.created_at DESC`, 
            [shop_id]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching escalated tickets:', error.message);
        res.status(500).json({ error: 'Failed to fetch escalated tickets' });
    }
});

// GET /api/fraud-flags?shop_domain=xxx
router.get('/fraud-flags', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            'SELECT * FROM reasoning_logs WHERE shop_domain = $1 AND fraud_flag = true ORDER BY created_at DESC', 
            [shop_domain]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching fraud flags:', error.message);
        res.status(500).json({ error: 'Failed to fetch fraud flags' });
    }
});

// GET /api/action-logs/:email?shop_domain=xxx
router.get('/action-logs/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            'SELECT * FROM action_logs WHERE shop_domain = $1 AND customer_email = $2 ORDER BY created_at DESC LIMIT 20', 
            [shop_domain, email]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching action logs:', error.message);
        res.status(500).json({ error: 'Failed to fetch action logs' });
    }
});

// GET /api/escalation-queue?shop_id=xxx
router.get('/escalation-queue', async (req, res) => {
    try {
        const { shop_id, shop_domain } = req.query;
        if (!shop_id && !shop_domain) return res.status(400).json({ error: 'shop_id or shop_domain is required' });

        let queryText;
        let params;

        if (shop_id) {
            queryText = `
                SELECT eq.*, s.id AS shop_id,
                       CASE WHEN LOWER(eq.reason) LIKE '%fraud%' THEN true ELSE false END AS fraud_flag
                FROM escalation_queue eq
                JOIN shops s ON eq.shop_domain = s.shop_domain
                WHERE s.id = $1
                ORDER BY
                    CASE eq.priority
                        WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2
                        ELSE 3
                    END ASC,
                    eq.created_at ASC`;
            params = [shop_id];
        } else {
            queryText = `
                SELECT eq.*, CASE WHEN LOWER(eq.reason) LIKE '%fraud%' THEN true ELSE false END AS fraud_flag
                FROM escalation_queue eq
                WHERE eq.shop_domain = $1
                ORDER BY
                    CASE eq.priority
                        WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2
                        ELSE 3
                    END ASC,
                    eq.created_at ASC`;
            params = [shop_domain];
        }

        const result = await db.query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching escalation queue:', error.message);
        res.status(500).json({ error: 'Failed to fetch escalation queue' });
    }
});

// GET /api/discount-codes/:email?shop_domain=xxx
router.get('/discount-codes/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            'SELECT * FROM discount_codes WHERE shop_domain = $1 AND customer_email = $2 ORDER BY created_at DESC', 
            [shop_domain, email]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching discount codes:', error.message);
        res.status(500).json({ error: 'Failed to fetch discount codes' });
    }
});

// PUT /api/escalation-queue/:id/resolve
router.put('/escalation-queue/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            `UPDATE escalation_queue 
             SET status = 'resolved', resolved_at = NOW() 
             WHERE id = $1 RETURNING *`, 
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Escalation not found' });
        }
        
        res.json({ success: true, escalation: result.rows[0] });
    } catch (error) {
        console.error('Error resolving escalation:', error.message);
        res.status(500).json({ error: 'Failed to resolve escalation' });
    }
});

// GET /api/action-stats?shop_domain=xxx
router.get('/action-stats', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });
        
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_actions,
                COUNT(*) FILTER (WHERE action_type = 'refund') as refunds_created,
                COUNT(*) FILTER (WHERE action_type = 'cancel') as orders_cancelled,
                COUNT(*) FILTER (WHERE action_type = 'discount') as discounts_given,
                COUNT(*) FILTER (WHERE action_type = 'escalation') as escalations,
                COUNT(*) FILTER (WHERE action_type = 'fraud_flag') as fraud_flags
             FROM action_logs 
             WHERE shop_domain = $1`, 
            [shop_domain]
        );
        
        res.json(result.rows[0] || { total_actions: 0 });
    } catch (error) {
        console.error('Error fetching action stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch action stats' });
    }
});

// Knowledge base endpoints
router.get('/knowledge-base', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });

        const entries = await ragService.getKnowledgeBase(shop_domain);
        res.json(entries);
    } catch (error) {
        console.error('Error fetching knowledge base:', error?.message || error);
        res.status(500).json({ error: 'Failed to fetch knowledge base' });
    }
});

router.post('/knowledge-base', async (req, res) => {
    try {
        const { shop_domain, category, question, answer } = req.body;
        if (!shop_domain || !question || !answer) return res.status(400).json({ error: 'shop_domain, question and answer are required' });

        const result = await ragService.addKnowledgeEntry(shop_domain, category || 'General', question, answer);
        res.json(result);
    } catch (error) {
        console.error('Error adding knowledge base entry:', error?.message || error);
        res.status(500).json({ error: 'Failed to add knowledge base entry' });
    }
});

router.delete('/knowledge-base/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { shop_domain } = req.body;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });

        const result = await ragService.deleteKnowledgeEntry(shop_domain, id);
        res.json(result);
    } catch (error) {
        console.error('Error deleting knowledge base entry:', error?.message || error);
        res.status(500).json({ error: 'Failed to delete knowledge base entry' });
    }
});

router.post('/knowledge-base/bulk', async (req, res) => {
    try {
        const { shop_domain, entries } = req.body;
        if (!shop_domain || !Array.isArray(entries)) return res.status(400).json({ error: 'shop_domain and entries array are required' });

        let count = 0;
        for (const entry of entries) {
            if (!entry.question || !entry.answer) continue;
            await ragService.addKnowledgeEntry(shop_domain, entry.category || 'General', entry.question, entry.answer);
            count += 1;
        }

        res.json({ success: true, count });
    } catch (error) {
        console.error('Error bulk importing knowledge base entries:', error?.message || error);
        res.status(500).json({ error: 'Failed to import knowledge base entries' });
    }
});

router.get('/knowledge-base/search', async (req, res) => {
    try {
        const { shop_domain, query } = req.query;
        if (!shop_domain || !query) return res.status(400).json({ error: 'shop_domain and query are required' });

        const results = await ragService.searchKnowledge(shop_domain, query.toString(), 3);
        res.json(results);
    } catch (error) {
        console.error('Error searching knowledge base:', error?.message || error);
        res.status(500).json({ error: 'Failed to search knowledge base' });
    }
});

// Settings endpoints
router.get('/settings', merchantController.getSettings);
router.post('/settings', merchantController.saveSettings);

// Analytics endpoints
router.get('/analytics/tickets-over-time', merchantController.getTicketsOverTime);
router.get('/analytics/intent-distribution', merchantController.getIntentDistribution);
router.get('/analytics/resolution-rate', merchantController.getResolutionRate);
router.get('/analytics/sentiment-trend', merchantController.getSentimentTrend);

// Existing analytics dashboard route kept for compatibility
router.get('/analytics/dashboard', async (req, res) => {
    try {
        const { shop_id, shop_domain } = req.query;
        if (!shop_id || !shop_domain) return res.status(400).json({ error: 'shop_id and shop_domain are required' });

        // Tickets Over Time (last 7 days)
        const ticketsOverTime = await db.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count 
             FROM tickets WHERE shop_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days' 
             GROUP BY DATE(created_at) ORDER BY date ASC`,
            [shop_id]
        );

        // Intent Distribution
        const intentDistribution = await db.query(
            `SELECT detected_intent as name, COUNT(*) as value 
             FROM tickets WHERE shop_id = $1 AND detected_intent IS NOT NULL 
             GROUP BY detected_intent`,
            [shop_id]
        );

        // Resolution Rate (last 7 days)
        const resolutionRate = await db.query(
            `SELECT DATE(created_at) as date, 
                    COUNT(*) FILTER (WHERE resolution_status = 'auto_resolved') as resolved,
                    COUNT(*) FILTER (WHERE resolution_status = 'escalated') as escalated
             FROM tickets WHERE shop_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days' 
             GROUP BY DATE(created_at) ORDER BY date ASC`,
            [shop_id]
        );

        // Sentiment Trends (last 7 days)
        const sentimentTrends = await db.query(
            `SELECT DATE(ch.created_at) as date, ROUND(AVG(CASE WHEN ch.sentiment = 'angry' THEN 0 WHEN ch.sentiment = 'frustrated' THEN 0.2 WHEN ch.sentiment = 'neutral' THEN 0.5 WHEN ch.sentiment = 'happy' THEN 1 ELSE 0.5 END)::numeric, 2) * 100 as average_sentiment
             FROM conversation_history ch WHERE ch.shop_domain = $1 AND ch.created_at >= CURRENT_DATE - INTERVAL '7 days' 
             GROUP BY DATE(ch.created_at) ORDER BY date ASC`,
            [shop_domain]
        );

        res.json({
            ticketsOverTime: ticketsOverTime.rows,
            intentDistribution: intentDistribution.rows,
            resolutionRate: resolutionRate.rows,
            sentimentTrends: sentimentTrends.rows,
        });

    } catch (error) {
        console.error('Error fetching analytics:', error.message);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// POST /api/csat
router.post('/csat', async (req, res) => {
    try {
        const { shop_domain, ticket_id, customer_email, rating, feedback } = req.body;

        if (!shop_domain || rating === undefined) {
            return res.status(400).json({ error: 'shop_domain and rating are required' });
        }

        if (rating !== 1 && rating !== -1) {
            return res.status(400).json({ error: 'Rating must be 1 (thumbs up) or -1 (thumbs down)' });
        }

        let intent = null;
        if (ticket_id) {
            const ticketResult = await db.query(
                'SELECT detected_intent FROM tickets WHERE id = $1',
                [ticket_id]
            );
            if (ticketResult.rows.length > 0) {
                intent = ticketResult.rows[0].detected_intent;
            }
        }

        await db.query(
            `INSERT INTO csat_ratings (shop_domain, ticket_id, customer_email, rating, feedback, intent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [shop_domain, ticket_id || null, customer_email || null, rating, feedback || null, intent]
        );

        console.log(`[CSAT] Rating received: ${rating} for ticket ${ticket_id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error recording CSAT rating:', error.message);
        res.status(500).json({ error: 'Failed to record CSAT rating' });
    }
});

// GET /api/csat/stats?shop_domain={domain}
router.get('/csat/stats', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) {
            return res.status(400).json({ error: 'shop_domain query parameter required' });
        }

        const statsResult = await db.query(
            `SELECT 
                COUNT(*)::integer as total_ratings,
                COUNT(*) FILTER (WHERE rating = 1)::integer as positive,
                COUNT(*) FILTER (WHERE rating = -1)::integer as negative
             FROM csat_ratings
             WHERE shop_domain = $1`,
            [shop_domain]
        );

        const recentResult = await db.query(
            `SELECT id, ticket_id, customer_email, rating, feedback, intent, created_at
             FROM csat_ratings
             WHERE shop_domain = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [shop_domain]
        );

        const stats = statsResult.rows[0] || { total_ratings: 0, positive: 0, negative: 0 };
        const total = stats.total_ratings || 0;
        const positive = stats.positive || 0;
        const negative = stats.negative || 0;
        const score = total > 0 ? Math.round((positive / total) * 100) : 100;

        console.log(`[CSAT] Stats fetched for ${shop_domain}`);
        res.json({
            total_ratings: total,
            positive: positive,
            negative: negative,
            score: score,
            recent: recentResult.rows
        });
    } catch (error) {
        console.error('Error fetching CSAT stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch CSAT stats' });
    }
});

// GET /api/csat/trend?shop_domain={domain}
router.get('/csat/trend', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) {
            return res.status(400).json({ error: 'shop_domain query parameter required' });
        }

        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push(dateStr);
        }

        const trendResult = await db.query(
            `SELECT 
                DATE(created_at)::text as date,
                COUNT(*)::integer as total,
                COUNT(*) FILTER (WHERE rating = 1)::integer as positive
             FROM csat_ratings
             WHERE shop_domain = $1
             AND created_at >= CURRENT_DATE - INTERVAL '6 days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC`,
            [shop_domain]
        );

        const dbData = {};
        trendResult.rows.forEach(row => {
            const total = parseInt(row.total) || 0;
            const positive = parseInt(row.positive) || 0;
            dbData[row.date] = total > 0 ? Math.round((positive / total) * 100) : 100;
        });

        const trend = days.map(date => ({
            date,
            score: dbData[date] !== undefined ? dbData[date] : 100
        }));

        res.json(trend);
    } catch (error) {
        console.error('Error fetching CSAT trend:', error.message);
        res.status(500).json({ error: 'Failed to fetch CSAT trend' });
    }
});

// GET /api/canned-responses?shop_domain={domain}
router.get('/canned-responses', async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) {
            return res.status(400).json({ error: 'shop_domain query parameter required' });
        }

        const result = await db.query(
            `SELECT id, shop_domain, title, intent, message, is_active, usage_count, created_at
             FROM canned_responses
             WHERE shop_domain = $1
             ORDER BY usage_count DESC`,
            [shop_domain]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching canned responses:', error.message);
        res.status(500).json({ error: 'Failed to fetch canned responses' });
    }
});

// POST /api/canned-responses
router.post('/canned-responses', async (req, res) => {
    try {
        const { shop_domain, title, intent, message } = req.body;
        if (!shop_domain || !title || !message) {
            return res.status(400).json({ error: 'shop_domain, title and message are required' });
        }

        const result = await db.query(
            `INSERT INTO canned_responses (shop_domain, title, intent, message)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [shop_domain, title, intent || null, message]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error creating canned response:', error.message);
        res.status(500).json({ error: 'Failed to create canned response' });
    }
});

// PUT /api/canned-responses/:id
router.put('/canned-responses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, intent, message, is_active } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'title and message are required' });
        }

        const activeVal = is_active !== undefined ? is_active : true;

        const result = await db.query(
            `UPDATE canned_responses
             SET title = $1, intent = $2, message = $3, is_active = $4
             WHERE id = $5
             RETURNING *`,
            [title, intent || null, message, activeVal, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Canned response not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating canned response:', error.message);
        res.status(500).json({ error: 'Failed to update canned response' });
    }
});

// DELETE /api/canned-responses/:id
router.delete('/canned-responses/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE canned_responses
             SET is_active = false
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Canned response not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error soft-deleting canned response:', error.message);
        res.status(500).json({ error: 'Failed to soft-delete canned response' });
    }
});

// POST /api/canned-responses/:id/use
router.post('/canned-responses/:id/use', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE canned_responses
             SET usage_count = usage_count + 1
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Canned response not found' });
        }

        console.log(`[Canned] Usage count updated for id: ${id}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error incrementing usage count:', error.message);
        res.status(500).json({ error: 'Failed to increment usage count' });
    }
});

module.exports = router;
