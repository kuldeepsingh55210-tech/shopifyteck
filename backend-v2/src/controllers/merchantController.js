const db = require('../db/db');

const getSettings = async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });

        console.log(`[Settings] Fetched settings for ${shop_domain}`);

        let result = await db.query('SELECT * FROM merchant_settings WHERE shop_domain = $1', [shop_domain]);
        if (result.rows.length === 0) {
            result = await db.query(
                `INSERT INTO merchant_settings (shop_domain) VALUES ($1) RETURNING *`,
                [shop_domain]
            );
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching settings:', error.message);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

const saveSettings = async (req, res) => {
    try {
        const {
            shop_domain,
            auto_resolve,
            escalate_angry,
            fraud_detection,
            vip_detection,
            escalation_threshold,
            fraud_refund_limit,
            min_confidence,
            email_notifications,
            notification_email
        } = req.body;

        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });

        const result = await db.query(
            `INSERT INTO merchant_settings (
                shop_domain,
                auto_resolve,
                escalate_angry,
                fraud_detection,
                vip_detection,
                escalation_threshold,
                fraud_refund_limit,
                min_confidence,
                email_notifications,
                notification_email,
                updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
             ON CONFLICT (shop_domain) DO UPDATE SET
                auto_resolve = $2,
                escalate_angry = $3,
                fraud_detection = $4,
                vip_detection = $5,
                escalation_threshold = $6,
                fraud_refund_limit = $7,
                min_confidence = $8,
                email_notifications = $9,
                notification_email = $10,
                updated_at = NOW()
             RETURNING *`,
            [
                shop_domain,
                auto_resolve,
                escalate_angry,
                fraud_detection,
                vip_detection,
                escalation_threshold,
                fraud_refund_limit,
                min_confidence,
                email_notifications,
                notification_email
            ]
        );

        console.log(`[Settings] Updated settings for ${shop_domain}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error saving settings:', error.message);
        res.status(500).json({ error: 'Failed to save settings' });
    }
};

const getTicketsOverTime = async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

        console.log(`[Analytics] Fetching data for shop ${shop_id}`);

        const result = await db.query(
            `SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date, COUNT(*) AS count
             FROM tickets
             WHERE shop_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at) ASC`,
            [shop_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tickets over time:', error.message);
        res.status(500).json({ error: 'Failed to fetch tickets over time' });
    }
};

const getIntentDistribution = async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

        console.log(`[Analytics] Fetching data for shop ${shop_id}`);

        const result = await db.query(
            `SELECT COALESCE(detected_intent, 'unknown') AS name, COUNT(*) AS value
             FROM tickets
             WHERE shop_id = $1
             GROUP BY detected_intent
             ORDER BY value DESC`,
            [shop_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching intent distribution:', error.message);
        res.status(500).json({ error: 'Failed to fetch intent distribution' });
    }
};

const getResolutionRate = async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.status(400).json({ error: 'shop_id is required' });

        console.log(`[Analytics] Fetching data for shop ${shop_id}`);

        const result = await db.query(
            `SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS date,
                    COUNT(*) FILTER (WHERE resolution_status = 'auto_resolved') AS auto_resolved,
                    COUNT(*) FILTER (WHERE resolution_status = 'escalated') AS escalated
             FROM tickets
             WHERE shop_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at) ASC`,
            [shop_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching resolution rate:', error.message);
        res.status(500).json({ error: 'Failed to fetch resolution rate' });
    }
};

const getSentimentTrend = async (req, res) => {
    try {
        const { shop_domain } = req.query;
        if (!shop_domain) return res.status(400).json({ error: 'shop_domain is required' });

        console.log(`[Analytics] Fetching data for shop ${shop_domain}`);

        const result = await db.query(
            `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS date,
                    COALESCE(ROUND(avg_sentiment.average_sentiment::numeric, 2), 0) AS average_sentiment
             FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS day
             LEFT JOIN (
               SELECT DATE(created_at) AS day,
                      AVG(CASE
                          WHEN sentiment = 'angry' THEN 0
                          WHEN sentiment = 'frustrated' THEN 0.25
                          WHEN sentiment = 'neutral' THEN 0.5
                          WHEN sentiment = 'happy' THEN 1
                          ELSE 0.5
                      END) * 100 AS average_sentiment
               FROM conversation_history
               WHERE shop_domain = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 days'
               GROUP BY DATE(created_at)
             ) avg_sentiment ON avg_sentiment.day = day
             ORDER BY day ASC`,
            [shop_domain]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sentiment trend:', error.message);
        res.status(500).json({ error: 'Failed to fetch sentiment trend' });
    }
};

module.exports = {
    getSettings,
    saveSettings,
    getTicketsOverTime,
    getIntentDistribution,
    getResolutionRate,
    getSentimentTrend
};
