const crypto = require('crypto');
const db = require('../db/db');

const createApprovalRequest = async ({ shopDomain, orderId, orderNumber, customerEmail, amount, reason }) => {
    const token = crypto.randomBytes(24).toString('hex');
    const result = await db.query(
        `INSERT INTO refund_approvals (shop_domain, order_id, order_number, customer_email, amount, reason, token, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING id, token, order_id, order_number, shop_domain, customer_email, amount, reason`,
        [shopDomain, orderId, orderNumber, customerEmail, amount, reason, token]
    );
    return result.rows[0];
};

const getByToken = async (token) => {
    const result = await db.query('SELECT * FROM refund_approvals WHERE token = $1', [token]);
    return result.rows[0] || null;
};

// Atomically flips status from 'pending' -> given status. Returns null if it was already resolved
// (prevents double-refunding if the merchant clicks the link twice or a stale email is reused).
const markResolved = async (token, status) => {
    const result = await db.query(
        `UPDATE refund_approvals SET status = $1, resolved_at = NOW() WHERE token = $2 AND status = 'pending' RETURNING *`,
        [status, token]
    );
    return result.rows[0] || null;
};

module.exports = { createApprovalRequest, getByToken, markResolved };
