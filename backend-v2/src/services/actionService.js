const axios = require('axios');
const db = require('../db/db');
const { decryptToken } = require('../utils/tokenEncryption');
const emailService = require('./emailService');

const getShopToken = async (shopDomain) => {
    const result = await db.query('SELECT access_token FROM shops WHERE shop_domain = $1', [shopDomain]);
    if (result.rows.length === 0 || !result.rows[0].access_token) {
        throw new Error('Shop token not found');
    }
    return decryptToken(result.rows[0].access_token);
};

const createRefund = async (shopDomain, orderId, reason) => {
    try {
        console.log(`[Action] Executing: createRefund for ${shopDomain}, order ${orderId}`);
        const token = await getShopToken(shopDomain);
        
        const response = await axios.post(
            `https://${shopDomain}/admin/api/2024-01/orders/${orderId}/refunds.json`,
            {
                refund: {
                    note: reason,
                    notify: true,
                    shipping: { full_refund: false },
                    transactions: []
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`[Action] Shopify API result: success`);
        return { success: true, refund_id: response.data.refund.id };
    } catch (error) {
        console.error(`[Action] Shopify API result: failed - ${error.message}`);
        return { success: false, error: error.response?.data || error.message };
    }
};

const cancelOrder = async (shopDomain, orderId, reason) => {
    try {
        console.log(`[Action] Executing: cancelOrder for ${shopDomain}, order ${orderId}`);
        const token = await getShopToken(shopDomain);
        
        const response = await axios.post(
            `https://${shopDomain}/admin/api/2024-01/orders/${orderId}/cancel.json`,
            {
                reason: reason,
                email: true,
                refund: true
            },
            {
                headers: {
                    'X-Shopify-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`[Action] Shopify API result: success`);
        return { success: true, cancelled: true };
    } catch (error) {
        console.error(`[Action] Shopify API result: failed - ${error.message}`);
        return { success: false, error: error.response?.data || error.message };
    }
};

const createDiscountCode = async (shopDomain, customerEmail, discountPercent) => {
    try {
        console.log(`[Action] Executing: createDiscountCode for ${customerEmail}`);
        const token = await getShopToken(shopDomain);
        
        // Step 1: Create price rule
        const priceRuleResponse = await axios.post(
            `https://${shopDomain}/admin/api/2024-01/price_rules.json`,
            {
                price_rule: {
                    title: "AI_SUPPORT_" + Date.now(),
                    target_type: "line_item",
                    target_selection: "all",
                    allocation_method: "across",
                    value_type: "percentage",
                    value: "-" + discountPercent,
                    customer_selection: "all",
                    starts_at: new Date().toISOString(),
                    usage_limit: 1
                }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const priceRuleId = priceRuleResponse.data.price_rule.id;
        const generatedCode = "SUPPORT" + Date.now();
        
        // Step 2: Create discount code
        await axios.post(
            `https://${shopDomain}/admin/api/2024-01/price_rules/${priceRuleId}/discount_codes.json`,
            {
                discount_code: { code: generatedCode }
            },
            {
                headers: {
                    'X-Shopify-Access-Token': token,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // Save to database
        await db.query(
            `INSERT INTO discount_codes (shop_domain, customer_email, discount_code, discount_percent)
             VALUES ($1, $2, $3, $4)`,
            [shopDomain, customerEmail, generatedCode, discountPercent]
        );
        
        console.log(`[Action] Shopify API result: success`);
        return { success: true, code: generatedCode, percent: discountPercent };
    } catch (error) {
        console.error(`[Action] Shopify API result: failed - ${error.message}`);
        return { success: false, error: error.response?.data || error.message };
    }
};

const sendEmailNotification = async (shopDomain, customerEmail, subject, message) => {
    console.log(`[Action] Executing: sendEmailNotification for ${customerEmail}`);
    
    await db.query(
        `INSERT INTO action_logs (shop_domain, customer_email, action_type, action_data, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [shopDomain, customerEmail, 'email', JSON.stringify({ subject, message }), true]
    );
    console.log(`[Action] Logged to action_logs`);
    
    // Trigger SMTP email using emailService
    await emailService.sendEmail(customerEmail, subject, message);
    
    return { success: true, logged: true };
};

const escalateToHuman = async (shopDomain, ticketId, customerEmail, reason, priority) => {
    try {
        console.log(`[Action] Executing: escalateToHuman for ${customerEmail}, priority: ${priority}`);
        const result = await db.query(
            `INSERT INTO escalation_queue (shop_domain, ticket_id, customer_email, reason, priority, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
            [shopDomain, ticketId, customerEmail, reason, priority]
        );

        const settingsResult = await db.query(
            'SELECT email_notifications, notification_email FROM merchant_settings WHERE shop_domain = $1',
            [shopDomain]
        );
        const settings = settingsResult.rows[0] || { email_notifications: false, notification_email: null };

        const alertRecipient = settings.email_notifications && settings.notification_email
            ? settings.notification_email
            : process.env.MERCHANT_ALERT_EMAIL;

        if (settings.email_notifications && alertRecipient) {
            await emailService.sendEscalationAlert(alertRecipient, customerEmail, reason, priority);
        }

        return { success: true, escalation_id: result.rows[0].id, priority };
    } catch (error) {
        console.error(`[Action] Escalation failed - ${error.message}`);
        return { success: false, error: error.message };
    }
};

const logAction = async (shopDomain, customerEmail, ticketId, actionType, actionData, success, errorMessage = null) => {
    try {
        await db.query(
            `INSERT INTO action_logs (shop_domain, customer_email, ticket_id, action_type, action_data, success, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [shopDomain, customerEmail, ticketId, actionType, actionData ? JSON.stringify(actionData) : null, success, errorMessage]
        );
        console.log(`[Action] Logged to action_logs`);
    } catch (error) {
        console.error(`[Action] Failed to log action - ${error.message}`);
    }
};

module.exports = {
    createRefund,
    cancelOrder,
    createDiscountCode,
    sendEmailNotification,
    escalateToHuman,
    logAction
};
