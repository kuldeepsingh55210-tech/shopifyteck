import { Request, Response } from 'express';
import { detectIntent } from '../services/ai.service';
import { fetchOrderStatus } from '../services/shopify.service';
import { pool } from '../db';

const CONFIDENCE_THRESHOLD = 0.85;

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const { shopDomain, customerEmail, messageBody, orderNumber } = req.body;

        if (!shopDomain || !messageBody) {
            return res.status(400).json({ error: 'Missing shopDomain or messageBody' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Upsert Shop
            const upsertShopQuery = `
        INSERT INTO shops (shop_domain) 
        VALUES ($1) 
        ON CONFLICT (shop_domain) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id;
      `;
            const shopResult = await client.query(upsertShopQuery, [shopDomain]);
            const shopId = shopResult.rows[0].id;

            // 2. Insert initial ticket state
            const insertTicketQuery = `
        INSERT INTO tickets (shop_id, customer_email, order_number, raw_message)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
            const ticketResult = await client.query(insertTicketQuery, [shopId, customerEmail, orderNumber, messageBody]);
            const ticketId = ticketResult.rows[0].id;

            // 3. Detect Intent & Confidence
            const { intent, confidenceScore } = await detectIntent(messageBody);
            console.log(`Intent: ${intent}, Confidence: ${confidenceScore}`);

            let responseMessage = '';
            let resolutionStatus = 'escalated';

            // 4. Guardrail Logic
            if (intent === 'OrderStatus' && confidenceScore >= CONFIDENCE_THRESHOLD) {
                responseMessage = await fetchOrderStatus(shopDomain, customerEmail);
                resolutionStatus = 'auto_resolved';
            } else {
                responseMessage = 'This ticket has been escalated to human support.';
                resolutionStatus = 'escalated';
            }

            // Map our AI intent to the expected enum
            let dbIntent = 'other';
            if (intent === 'OrderStatus') dbIntent = 'order_status';
            if (intent === 'RefundRequest') dbIntent = 'refund';
            if (intent === 'ProductQuestion') dbIntent = 'other'; // no direct mapping for this simple example

            // 5. Update Ticket Outcome
            const updateTicketQuery = `
        UPDATE tickets
        SET detected_intent = $1,
            intent_confidence = $2,
            resolution_status = $3,
            ai_response = $4,
            response_confidence = $5,
            resolved_at = $6
        WHERE id = $7;
      `;
            const resolvedAt = resolutionStatus === 'auto_resolved' ? new Date() : null;
            await client.query(updateTicketQuery, [
                dbIntent, confidenceScore, resolutionStatus, responseMessage, confidenceScore, resolvedAt, ticketId
            ]);

            // 6. Automation Log
            const insertLogQuery = `
        INSERT INTO automation_logs (ticket_id, action_taken, shopify_data_snapshot)
        VALUES ($1, $2, $3);
      `;
            await client.query(insertLogQuery, [
                ticketId,
                resolutionStatus === 'auto_resolved' ? 'AI Auto-Response Sent' : 'Escalated to Support',
                JSON.stringify({ orderFound: resolutionStatus === 'auto_resolved' })
            ]);

            await client.query('COMMIT');

            // Respond directly
            return res.status(200).json({
                ticketId,
                detectedIntent: dbIntent,
                resolutionStatus,
                responseMessage,
            });

        } catch (innerError) {
            await client.query('ROLLBACK');
            throw innerError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error handling webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
