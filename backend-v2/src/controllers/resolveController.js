const db = require('../db/db');
const { detectIntent } = require('../services/intentDetectionService');
const { getOrderData } = require('../services/orderLookupService');
const { generateResponse } = require('../services/responseGeneratorService');
const { decryptToken } = require('../utils/tokenEncryption');
const memoryService = require('../services/memoryService');
const reasoningService = require('../services/reasoningService');
const ragService = require('../services/ragService');

const resolveOrder = async (req, res) => {
    let { shop_id, customer_message, order_number, customer_email } = req.body;

    console.log(`\n[Resolve] ========== STARTING REASONING FLOW ==========`);
    console.log(`[Resolve] shop_id: ${shop_id}, order: ${order_number}, email: ${customer_email}`);

    // Step 0: Validate inputs
    if (!shop_id || !customer_message) {
        return res.status(400).json({ success: false, error: 'shop_id and customer_message are required' });
    }

    // Default fallback values if skipped by storefront customer widget
    if (!customer_email || !customer_email.trim()) {
        customer_email = 'guest@customer.com';
    }
    if (!order_number || !order_number.trim()) {
        order_number = 'NONE';
    }

    // Fetch shop from DB
    const shopResult = await db.query('SELECT * FROM shops WHERE id = $1 AND is_active = true', [shop_id]);
    if (shopResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Shop not found' });
    }
    const shop = shopResult.rows[0];

    // Validate access token
    if (!shop.access_token) {
        return res.json({ success: false, resolution: 'escalated', response: 'System configuration error. Please contact support.', intent: 'unknown', confidence: 0, escalated: true, fraud_flag: false, reasoning: 'Missing access token', language: 'english' });
    }

    try {
        const token = decryptToken(shop.access_token);
        if (!token) throw new Error("Empty token");
    } catch (e) {
        return res.json({ success: false, resolution: 'escalated', response: 'System configuration error. Please contact support.', intent: 'unknown', confidence: 0, escalated: true, fraud_flag: false, reasoning: 'Invalid access token', language: 'english' });
    }

    // Fetch Merchant Settings
    const settingsResult = await db.query('SELECT * FROM merchant_settings WHERE shop_domain = $1', [shop.shop_domain]);
    const settingsRow = settingsResult.rows[0] || {};
    const settings = {
        auto_resolve: settingsRow.auto_resolve ?? settingsRow.auto_resolve_enabled ?? true,
        escalate_angry: settingsRow.escalate_angry ?? settingsRow.escalate_angry_enabled ?? true,
        fraud_detection: settingsRow.fraud_detection ?? settingsRow.fraud_flagging_enabled ?? true,
        vip_detection: settingsRow.vip_detection ?? true,
        escalation_threshold: parseInt(settingsRow.escalation_threshold ?? 60, 10),
        fraud_refund_limit: settingsRow.fraud_refund_limit ?? 3,
        min_confidence: settingsRow.min_confidence ?? 50,
        email_notifications: settingsRow.email_notifications ?? false,
        notification_email: settingsRow.notification_email ?? null
    };

    console.log(`[Fix] Escalation threshold loaded: ${settings.escalation_threshold}`);

    if (settings.auto_resolve === false) {
        const manualResponse = 'Auto resolve disabled by merchant. This ticket requires manual review by your support team.';

        const ticket = await saveTicket({
            shop_id,
            customer_email,
            order_number,
            raw_message: customer_message,
            detected_intent: 'manual_review',
            intent_confidence: 0,
            resolution_status: 'manual',
            ai_response: manualResponse,
            response_confidence: 0,
            resolved_at: null
        });

        await memoryService.saveConversation(shop.shop_domain, customer_email, customer_message, 'manual_review', 'neutral', 'manual', manualResponse);
        await memoryService.updateCustomerAfterInteraction(shop.shop_domain, customer_email, {
            intent: 'manual_review',
            sentiment: 'neutral',
            wasRefund: false,
            wasApproved: false,
            totalOrders: order_number ? 0 : 0
        });

        console.log('[Resolve] Auto resolve disabled - created manual ticket');
        const csat_token = Buffer.from(String(ticket.id) + shop.shop_domain).toString('base64');
        return res.json({
            success: true,
            resolution: 'manual',
            response: manualResponse,
            intent: 'manual_review',
            confidence: 0,
            escalated: false,
            fraud_flag: false,
            reasoning: 'Auto resolve disabled by merchant',
            language: 'english',
            csat_token,
            ticket_id: ticket.id
        });
    }

    // Step 1: Get customer memory
    console.log(`[Resolve] Step 1: Initializing memory...`);
    const customerMemory = await memoryService.getOrCreateCustomer(shop.shop_domain, customer_email);
    const customerContext = await memoryService.getCustomerContext(shop.shop_domain, customer_email);
    await memoryService.detectLanguagePreference(shop.shop_domain, customer_email, customer_message);

    const customerMessage = customer_message;
    console.log('[RAG] Starting context fetch...');
    let ragContext = '';
    try {
        console.log('[RAG] Starting for message:', customerMessage);
        ragContext = await ragService.buildRAGContext(
            shop.shop_domain,
            customerMessage
        );
        console.log('[RAG] Context fetched, length:', ragContext.length);
    } catch (ragError) {
        console.log('[RAG] Error fetching context:', ragError.message);
        ragContext = '';
    }

    if (ragContext) {
        console.log('[Resolve] RAG context injected:', ragContext.length, 'chars');
    } else {
        console.log('[Resolve] No RAG context found');
    }

    // Step 2: Detect intent + emotion
    console.log(`[Resolve] Step 2: Detecting intent...`);
    const intentResult = await detectIntent(customer_message, customerContext, shop.shop_domain, ragContext);

    // Fallback: Hardcoded keyword check in case LLM rate-limits or misses sentiment
    const angryKeywords = ['furious', 'worst', 'hate', 'terrible', 'horrible', 'angry', 'disgusting', 'useless', 'pathetic', 'frustrated', 'damn'];
    const messageText = customer_message.toLowerCase();
    const isAngryMessage = angryKeywords.some(word => messageText.includes(word));
    
    if (isAngryMessage) {
        intentResult.sentiment = 'angry';
        intentResult.intent = 'angry_customer';
    }

    const detectedIntent = intentResult.intent;
    const lowerCustomerMessage = customerMessage.toLowerCase();
    
    // Intents that don't need order lookup and should auto-resolve
    const noOrderNeededIntents = [
        'greeting',
        'unknown',
        'general_inquiry',
        'product_query',
        'wrong_item',
        'cancel_order',
        'discount_issue',
        'payment_issue',
        'size_query'
    ];
    
    const isPolicyQuestion =
        lowerCustomerMessage.includes('policy') ||
        lowerCustomerMessage.includes('shipping time') ||
        lowerCustomerMessage.includes('delivery time') ||
        noOrderNeededIntents.includes(detectedIntent);

    // Helper function to check if intent requires order lookup
    const doesIntentRequireOrder = (intent) => {
        const orderRequiredIntents = ['order_status', 'shipping_status', 'delivery_issue', 'refund_request', 'exchange_request'];
        return orderRequiredIntents.includes(intent);
    };

    const hasExplicitOrderNumber = order_number !== 'NONE' && order_number.trim().length > 0;
    const intentRequiresOrder = doesIntentRequireOrder(detectedIntent);

    let orderData = null;
    let orderLookupSkipped = false;

    const isAngry = (detectedIntent === 'angry_customer' || intentResult.sentiment === 'angry');

    if (isPolicyQuestion) {
        console.log('[Resolve] Policy question detected, skipping order lookup');
        orderLookupSkipped = true;
    } else if (!intentRequiresOrder) {
        console.log(`[Resolve] Intent "${detectedIntent}" does not require order lookup, using Knowledge Base instead`);
        orderLookupSkipped = true;
    } else if (!hasExplicitOrderNumber) {
        if (isAngry) {
            console.log(`[Resolve] No explicit order number provided for angry customer with order-required intent "${detectedIntent}", escalating`);
            const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'escalated' });
            await logAction(ticket.id, 'ESCALATED', { reason: 'order_number_required' });
            const csat_token = Buffer.from(String(ticket.id) + shop.shop_domain).toString('base64');
            return res.json({ success: true, resolution: 'escalated', response: 'Please provide your order number so we can assist you better.', intent: intentResult.intent, confidence: intentResult.confidence, escalated: true, fraud_flag: false, reasoning: 'order_number_required', language: 'english', csat_token, ticket_id: ticket.id });
        } else {
            console.log(`[Resolve] No explicit order number provided for non-angry intent "${detectedIntent}", skipping order lookup`);
            orderLookupSkipped = true;
        }
    } else {
        // Step 3: Get order data - ONLY for order-required intents with explicit order number
        console.log(`[Resolve] Step 3: Fetching order data for intent "${detectedIntent}" with order number "${order_number}"...`);
        const orderDataResult = await getOrderData(shop.shop_domain, shop.access_token, order_number, customer_email);
        orderData = orderDataResult.found ? orderDataResult : null;

        if (!orderData) {
            if (isAngry) {
                console.log(`[Resolve] Order not found for angry customer with intent "${detectedIntent}", escalating`);
                const ticket = await saveTicket({ shop_id, customer_email, order_number, raw_message: customer_message, detected_intent: intentResult.intent, intent_confidence: intentResult.confidence, resolution_status: 'escalated' });
                await logAction(ticket.id, 'ESCALATED', { reason: 'order_not_found' });
                const csat_token = Buffer.from(String(ticket.id) + shop.shop_domain).toString('base64');
                return res.json({ success: true, resolution: 'escalated', response: 'Order not found. Redirecting to human support.', intent: intentResult.intent, confidence: intentResult.confidence, escalated: true, fraud_flag: false, reasoning: 'order_not_found', language: 'english', csat_token, ticket_id: ticket.id });
            } else {
                console.log(`[Resolve] Order not found for non-angry intent "${detectedIntent}", skipping order lookup`);
                orderLookupSkipped = true;
            }
        }
    }

    let decision = null;
    let escalationData = null;
    let eligibility = null;

    // SPECIAL HANDLING: Force escalation for angry customers
    if (detectedIntent === 'angry_customer' && settings.escalate_angry) {
        console.log('[Resolve] Angry customer detected - forcing escalation');
        decision = { action: 'escalate', confidence: 0.95, reasoning: 'Angry customer - escalated to senior support' };
        escalationData = { should_escalate: true, probability: 100 };
        eligibility = { eligible: false, fraud_flag: false };
    } // For order lookup skipped cases (policy questions or general inquiries), auto-resolve with KB
    else if (isPolicyQuestion || orderLookupSkipped) {
        console.log('[Resolve] Skipping reasoning (isPolicyQuestion or general inquiry), auto-resolving with Knowledge Base');
        decision = { action: 'auto_resolve', confidence: 0.85 };
        escalationData = { should_escalate: false, probability: 0 };
        eligibility = { eligible: true, fraud_flag: false };
    } else {
        // Step 4: REASONING
        console.log(`[Resolve] Step 4: Applying Reasoning Engine...`);
        eligibility = {};
        if (intentResult.intent === 'refund_request') {
            eligibility = reasoningService.evaluateRefundEligibility(orderData, customerMemory);
        } else if (intentResult.intent === 'cancel_order') {
            eligibility = reasoningService.evaluateCancellationEligibility(orderData, customerMemory);
        }

        escalationData = reasoningService.calculateEscalationProbability(customerMemory, intentResult.intent, intentResult.sentiment);
        decision = reasoningService.makeDecision(intentResult.intent, eligibility, escalationData, customerMemory, customer_message);
    }

    // Add custom memory rule forcing angry sentiment to escalation
    if (!(isPolicyQuestion || orderLookupSkipped) && customerMemory.sentiment_score < 0.2) {
        decision.action = 'escalate';
        decision.reasoning = 'Low historical sentiment score forced escalation';
    }

    if (!(isPolicyQuestion || orderLookupSkipped) && intentResult.intent === 'refund_request' && customerMemory.refund_request_count >= settings.fraud_refund_limit && settings.fraud_detection) {
        decision.action = 'flag_fraud';
        decision.reasoning = `Refund request count exceeded fraud threshold of ${settings.fraud_refund_limit}.`;
    }

    if (!settings.fraud_detection && decision.action === 'flag_fraud') {
        decision.action = 'escalate';
        decision.reasoning = 'Fraud detection disabled by merchant, handled as general escalation.';
    }

    if (!settings.escalate_angry && (intentResult.intent === 'angry_customer' || intentResult.sentiment === 'angry')) {
        if (decision.action === 'escalate' || decision.action === 'flag_fraud') {
            decision.action = 'auto_resolve';
            decision.reasoning = 'Escalate angry customers disabled by merchant, attempting auto-resolve instead.';
        }
    }

    if (!(isPolicyQuestion || orderLookupSkipped) && !settings.auto_resolve && decision.action === 'auto_resolve') {
        decision.action = 'escalate';
        decision.reasoning = 'Auto-resolve disabled by merchant, forced escalation.';
    }

    if (!(isPolicyQuestion || orderLookupSkipped) && decision.action === 'auto_resolve' && typeof decision.confidence === 'number' && decision.confidence < settings.min_confidence) {
        decision.action = 'escalate';
        decision.reasoning = `Auto-resolve confidence ${decision.confidence}% below merchant minimum ${settings.min_confidence}%.`;
    }

    console.log(`[Fix] Escalation probability: ${escalationData.probability} vs threshold: ${settings.escalation_threshold}`);
    if (!(isPolicyQuestion || orderLookupSkipped) && escalationData.probability >= settings.escalation_threshold && decision.action !== 'flag_fraud') {
        decision.action = 'escalate';
        decision.reasoning = `Escalation threshold (${settings.escalation_threshold}) exceeded (${escalationData.probability}).`;
    }

    // Ensure ONLY angry_customer (or angry sentiment) can escalate to human, otherwise fallback to auto-resolve
    const isAngryIntent = (detectedIntent === 'angry_customer' || intentResult.sentiment === 'angry');
    if (!isAngryIntent && (decision.action === 'escalate' || decision.action === 'flag_fraud')) {
        console.log(`[Resolve] Overriding decision "${decision.action}" to "auto_resolve" because only angry_customer can escalate`);
        decision.action = 'auto_resolve';
        decision.reasoning = `Overridden to auto_resolve because intent "${detectedIntent}" is not angry_customer`;
    }

    console.log('[Resolve] Final decision before routing:', decision.action, 'isPolicyQuestion:', isPolicyQuestion);
    const reasoningContextStr = reasoningService.buildReasoningContext(customerMemory, orderData, intentResult.intent, intentResult.sentiment, escalationData.probability);

    const actionService = require('../services/actionService');
    
    // Step 5: Route by decision
    console.log(`[Resolve] Step 5: Routing decision -> ${decision.action}`);
    let resolutionStatus = decision.action === 'auto_resolve' ? 'auto_resolved' : 'escalated';
    if (decision.action === 'collect_info') {
        resolutionStatus = 'resolved';
    }
    if (intentResult.intent === 'angry_customer' || intentResult.sentiment === 'angry') {
        if (decision.action !== 'auto_resolve') {
            resolutionStatus = 'escalated';
        }
    }
    let isFraud = decision.action === 'flag_fraud';
    let isEscalated = ['escalate', 'flag_fraud'].includes(decision.action);
    let finalResponse = '';

    if (decision.action === 'escalate') {
        finalResponse = await generateResponse(orderData, customer_message, intentResult.intent, [reasoningContextStr, "You must escalate this ticket. Respond empathetically and inform the customer that a human agent will assist them shortly."], ragContext, shop.shop_domain, intentResult.language);
        // Escalate action
        await actionService.escalateToHuman(shop.shop_domain, null, customer_email, decision.reasoning, 'high'); // ticketId updated later
        await actionService.sendEmailNotification(shop.shop_domain, customer_email, 'Your ticket has been escalated', 'A support agent will contact you within 2 hours.');
        await actionService.logAction(shop.shop_domain, customer_email, null, 'escalation', { reason: decision.reasoning }, true);
        
        if (settings.discount_enabled && intentResult.intent === 'angry_customer') {
            const coupon = await actionService.createDiscountCode(shop.shop_domain, customer_email, settings.discount_percent);
            if (coupon.success) {
                finalResponse += ` As an apology, here is a ${settings.discount_percent}% discount: ${coupon.code}`;
            }
        }
    } else if (decision.action === 'flag_fraud') {
        finalResponse = await generateResponse(orderData, customer_message, intentResult.intent, [reasoningContextStr, "SECURITY ALERT: High fraud risk. Do not approve requests. Politely inform the customer that their request requires manual verification by our security team."], ragContext, shop.shop_domain, intentResult.language);
        // Fraud flag escalation
        await actionService.escalateToHuman(shop.shop_domain, null, customer_email, 'Fraud flag triggered', 'high');
        await actionService.logAction(shop.shop_domain, customer_email, null, 'fraud_flag', { reason: 'Triggered by high refund count' }, true);
    } else if (decision.action === 'auto_resolve') {
        if (isPolicyQuestion || orderLookupSkipped) {
            console.log('[Resolve] General inquiry or policy question - skipping action engine');
            let customInstructions = [reasoningContextStr];
            if (intentRequiresOrder) {
                if (!hasExplicitOrderNumber) {
                    let alreadyAsked = false;
                    try {
                        const lastConversations = await db.query(
                            `SELECT message, ai_response, intent, resolution 
                             FROM conversation_history 
                             WHERE shop_domain = $1 AND customer_email = $2 
                             ORDER BY created_at DESC 
                             LIMIT 1`,
                            [shop.shop_domain, customer_email]
                        );
                        if (lastConversations.rows.length > 0) {
                            const lastAiResponse = (lastConversations.rows[0].ai_response || '').toLowerCase();
                            if (lastAiResponse.includes('order number') || lastAiResponse.includes('order no') || lastAiResponse.includes('provide your order') || lastAiResponse.includes('order #')) {
                                alreadyAsked = true;
                            }
                        }
                    } catch (dbError) {
                        console.error('[Resolve] Error checking conversation history:', dbError.message);
                    }

                    if (alreadyAsked) {
                        customInstructions.push("The customer did not provide an order number again, even though we already asked for it in the previous message. Say something different this time to remind them politely, such as: 'I still need your order number to check the status.'");
                    } else {
                        customInstructions.push("The customer did not provide an order number. Politely ask them to provide their order number so we can look up their order.");
                    }
                } else if (!orderData) {
                    customInstructions.push(`We could not find any order with order number "${order_number}" in our system. Inform the customer politely that their order "${order_number}" was not found and ask them to verify the order number.`);
                }
            }
            finalResponse = await generateResponse(orderData, customer_message, intentResult.intent, customInstructions, ragContext, shop.shop_domain, intentResult.language);
        } else {
            finalResponse = await generateResponse(orderData, customer_message, intentResult.intent, [reasoningContextStr], ragContext, shop.shop_domain, intentResult.language);
            
            // Execute specific actions based on intent
            if (intentResult.intent === 'refund_request' && eligibility.eligible === true) {
                const result = await actionService.createRefund(shop.shop_domain, orderData.id || order_number, 'Customer request via AI Support');
                if (result.success) {
                    finalResponse += ` Your refund ID is: ${result.refund_id}.`;
                }
                await actionService.logAction(shop.shop_domain, customer_email, null, 'refund', { order: orderData.id || order_number }, result.success, result.error);
            } else if (intentResult.intent === 'cancel_order' && eligibility.eligible === true) {
                const result = await actionService.cancelOrder(shop.shop_domain, orderData.id || order_number, 'Customer request via AI Support');
                if (result.success) {
                    finalResponse += ` Your order has been cancelled.`;
                }
                await actionService.logAction(shop.shop_domain, customer_email, null, 'cancel', { order: orderData.id || order_number }, result.success, result.error);
            } else if (intentResult.intent === 'angry_customer' || intentResult.sentiment === 'angry') {
                if (settings.discount_enabled) {
                    const coupon = await actionService.createDiscountCode(shop.shop_domain, customer_email, settings.discount_percent);
                    if (coupon.success) {
                        finalResponse += ` As an apology for the inconvenience, here is a ${settings.discount_percent}% discount code for your next order: ${coupon.code}.`;
                    }
                    await actionService.logAction(shop.shop_domain, customer_email, null, 'discount', { percent: settings.discount_percent, code: coupon.code }, coupon.success, coupon.error);
                }
            }
        }
    } else if (decision.action === 'collect_info') {
        // Treat as auto_resolve
        // Generate response asking for more info
        // Set ticket status to 'resolved' NOT 'escalated'
        console.log('[Resolve] collect_info → auto resolving with info request');
        finalResponse = await generateResponse(orderData, customer_message, intentResult.intent, [reasoningContextStr, "We need more information. Ask the customer for details required to process their request."], ragContext, shop.shop_domain, intentResult.language);
    }

    // Step 6: Save reasoning log
    console.log(`[Resolve] Step 6: Saving reasoning log...`);
    await reasoningService.logReasoning(
        shop.shop_domain, 
        customer_email, 
        null, // We don't have ticket ID yet
        intentResult.intent, 
        intentResult.sentiment, 
        escalationData.probability, 
        decision.action, 
        decision.reasoning, 
        isFraud, 
        eligibility.eligible ? eligibility.eligible.toString() : null
    );

    // Finalize interaction (save ticket and memory)
    console.log(`[Resolve] Step 7: Updating memory and tickets...`);
    const ticket = await saveTicket({
        shop_id, customer_email, order_number, raw_message: customer_message,
        detected_intent: intentResult.intent, intent_confidence: intentResult.confidence,
        resolution_status: resolutionStatus, ai_response: finalResponse,
        response_confidence: decision.confidence, resolved_at: (decision.action === 'auto_resolve' || decision.action === 'collect_info') ? new Date() : null
    });

    // Update the reasoning log with the actual ticket ID now that we have it
    await db.query(
        `UPDATE reasoning_logs 
         SET ticket_id = $1 
         WHERE id = (
             SELECT id FROM reasoning_logs 
             WHERE shop_domain = $2 AND customer_email = $3 
             ORDER BY id DESC LIMIT 1
         )`, 
        [ticket.id, shop.shop_domain, customer_email]
    );

    // Update action_logs and escalation_queue with actual ticket ID
    await db.query(
        `UPDATE action_logs 
         SET ticket_id = $1 
         WHERE shop_domain = $2 AND customer_email = $3 AND ticket_id IS NULL`, 
        [ticket.id, shop.shop_domain, customer_email]
    );
    
    await db.query(
        `UPDATE escalation_queue 
         SET ticket_id = $1 
         WHERE shop_domain = $2 AND customer_email = $3 AND ticket_id IS NULL`, 
        [ticket.id, shop.shop_domain, customer_email]
    );

    await logAction(ticket.id, decision.action.toUpperCase(), { reason: decision.reasoning });
    
    await memoryService.saveConversation(shop.shop_domain, customer_email, customer_message, intentResult.intent, intentResult.sentiment || 'neutral', resolutionStatus, finalResponse);
    await memoryService.updateCustomerAfterInteraction(shop.shop_domain, customer_email, {
        intent: intentResult.intent,
        sentiment: intentResult.sentiment || 'neutral',
        wasRefund: intentResult.intent === 'refund_request',
        wasApproved: decision.action === 'auto_resolve' && intentResult.intent === 'refund_request',
        totalOrders: orderData?.customer?.orders_count
    });

    // Step 8: Return response
    console.log(`[Resolve] ========== FINISHED REASONING FLOW ==========`);
    const csat_token = Buffer.from(String(ticket.id) + shop.shop_domain).toString('base64');
    return res.json({
        success: true,
        resolution: resolutionStatus,
        response: finalResponse,
        intent: intentResult.intent,
        confidence: decision.confidence,
        escalated: isEscalated,
        fraud_flag: isFraud,
        reasoning: decision.reasoning,
        language: intentResult.language,
        csat_token,
        ticket_id: ticket.id
    });
};

const saveTicket = async (data) => {
    const result = await db.query(
        `INSERT INTO tickets (shop_id, customer_email, order_number, raw_message, detected_intent, intent_confidence, resolution_status, ai_response, response_confidence, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [data.shop_id, data.customer_email, data.order_number, data.raw_message, data.detected_intent, data.intent_confidence, data.resolution_status, data.ai_response || null, data.response_confidence || null, data.resolved_at || null]
    );
    return result.rows[0];
};

const logAction = async (ticketId, action, details) => {
    try {
        await db.query(
            `INSERT INTO automation_logs (ticket_id, action_taken, shopify_data_snapshot) VALUES ($1, $2, $3)`,
            [ticketId, action, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('Error logging action:', error.message);
    }
};

module.exports = { resolveOrder };