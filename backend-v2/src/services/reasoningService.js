const db = require('../db/db');

const evaluateRefundEligibility = (orderData, customerMemory, merchantPolicy = {}) => {
    try {
        console.log(`[Reasoning] Evaluating refund eligibility for order ${orderData?.id}`);
        if (!orderData || !orderData.created_at) {
            return { eligible: 'review', reason: 'Missing order data' };
        }

        const orderDate = new Date(orderData.created_at);
        const today = new Date();
        const diffTime = Math.abs(today - orderDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 30) {
            return { eligible: false, reason: 'Order older than 30 days' };
        }

        if (customerMemory && customerMemory.refund_request_count >= 3) {
            return { eligible: 'review', reason: 'High refund history - needs manual review', fraud_flag: true };
        }

        if (orderData.fulfillment_status === 'fulfilled') {
            return { eligible: true, reason: 'Order fulfilled, refund possible' };
        }

        if (orderData.fulfillment_status === 'unfulfilled' || !orderData.fulfillment_status) {
            return { eligible: true, reason: 'Order not shipped, full refund possible' };
        }

        return { eligible: 'review', reason: 'Manual review required' };
    } catch (error) {
        console.error(`[Reasoning] Error in evaluateRefundEligibility: ${error.message}`);
        return { eligible: 'review', reason: 'Error evaluating eligibility' };
    }
};

const evaluateCancellationEligibility = (orderData, customerMemory) => {
    try {
        console.log(`[Reasoning] Evaluating cancellation eligibility for order ${orderData?.id}`);
        if (!orderData) {
            return { eligible: true, reason: 'Manual review required' };
        }

        if (orderData.fulfillment_status === 'fulfilled') {
            return { eligible: false, reason: 'Order already shipped, cannot cancel' };
        }

        if (orderData.financial_status === 'paid') {
            return { eligible: true, reason: 'Order paid but not shipped, cancellation possible' };
        }

        return { eligible: true, reason: 'Order can be cancelled' };
    } catch (error) {
        console.error(`[Reasoning] Error in evaluateCancellationEligibility: ${error.message}`);
        return { eligible: true, reason: 'Error evaluating cancellation' };
    }
};

const calculateEscalationProbability = (customerMemory, intent, sentiment) => {
    let score = 0;
    
    if (sentiment === 'angry') score += 40;
    if (customerMemory && customerMemory.sentiment_score < 0.3) score += 30;
    if (intent === 'human_handoff') score += 50;
    if (customerMemory && customerMemory.refund_request_count >= 3) score += 20;
    if (customerMemory && customerMemory.is_vip === true) score += 10;
    
    const probability = Math.min(score, 100);
    const should_escalate = score >= 60;
    
    console.log(`[Reasoning] Escalation probability: ${probability}% (should_escalate: ${should_escalate})`);
    
    return { probability, should_escalate };
};

const buildReasoningContext = (customerMemory, orderData, intent, sentiment, escalationScore) => {
    const fraudFlag = customerMemory && customerMemory.refund_request_count >= 3 ? 'YES' : 'NO';
    const orderAgeDays = orderData && orderData.created_at ? 
        Math.ceil(Math.abs(new Date() - new Date(orderData.created_at)) / (1000 * 60 * 60 * 24)) : 'Unknown';

    return `REASONING CONTEXT:
=== Customer Profile ===
- Name: ${customerMemory?.customer_name || 'Unknown'}
- Total tickets: ${customerMemory?.total_tickets || 0}
- Refund history: ${customerMemory?.refund_request_count || 0} requests
- Sentiment score: ${customerMemory?.sentiment_score !== undefined ? customerMemory.sentiment_score : 0.5}/1.0
- VIP status: ${customerMemory?.is_vip || false}
- Language: ${customerMemory?.language_preference || 'english'}
- Fraud flag: ${fraudFlag}

=== Order Information ===
- Order ID: ${orderData?.id || orderData?.order_number || 'Unknown'}
- Status: ${orderData?.fulfillment_status || 'Unknown'}
- Payment: ${orderData?.financial_status || 'Unknown'}
- Order age: ${orderAgeDays} days old

=== Current Situation ===
- Detected intent: ${intent}
- Customer sentiment: ${sentiment}
- Escalation probability: ${escalationScore}%

=== AI Instructions ===
- Reason carefully before responding
- Check eligibility before making promises
- Never promise what you cannot deliver
- Be empathetic but accurate
- Respond in: ${customerMemory?.language_preference || 'english'}`;
};

const makeDecision = (intent, eligibility, escalationData, customerMemory, customerMessage = '') => {
    let action = 'collect_info';
    let reasoning = '';
    const normalizedMessage = (customerMessage || '').toLowerCase();
    const isPolicyQuestion = intent === 'general_inquiry' || intent === 'product_query' || /policy|shipping time|delivery time|exchange|return/.test(normalizedMessage);

    if (isPolicyQuestion) {
        action = 'auto_resolve';
        reasoning = 'Policy/general inquiry should be handled by merchant knowledge base and does not require order data';
        console.log(`[Reasoning] Policy question auto-resolve: ${reasoning}`);
        return {
            action,
            confidence: 0.9,
            reasoning,
            workflow: intent
        };
    }

    if (escalationData.should_escalate === true) {
        action = 'escalate';
        reasoning = 'High escalation probability';
    } else if (eligibility && eligibility.fraud_flag === true) {
        action = 'flag_fraud';
        reasoning = eligibility.reason || 'Fraud flag detected';
    } else if (eligibility && eligibility.eligible === true) {
        action = 'auto_resolve';
        reasoning = eligibility.reason || 'Eligible for auto-resolution';
    } else if (eligibility && eligibility.eligible === 'review') {
        action = 'escalate';
        reasoning = eligibility.reason || 'Manual review required';
    } else if (eligibility && eligibility.eligible === false) {
        action = 'auto_resolve'; // We can auto resolve by telling them they are NOT eligible
        reasoning = eligibility.reason || 'Not eligible';
    } else {
        action = 'collect_info';
        reasoning = 'Insufficient data to make a final decision';
    }

    console.log(`[Reasoning] Decision: ${action} - ${reasoning}`);
    
    return {
        action,
        confidence: 0.9,
        reasoning,
        workflow: intent
    };
};

const logReasoning = async (shopDomain, customerEmail, ticketId, intent, sentiment, escalationProb, decision, reasoningSummary, fraudFlag, refundEligible) => {
    try {
        await db.query(
            `INSERT INTO reasoning_logs 
             (shop_domain, customer_email, ticket_id, intent, sentiment, escalation_probability, decision, reasoning_summary, fraud_flag, refund_eligible) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [shopDomain, customerEmail, ticketId, intent, sentiment, escalationProb, decision, reasoningSummary, fraudFlag || false, refundEligible || null]
        );
    } catch (error) {
        console.error(`[Reasoning] Error logging reasoning: ${error.message}`);
    }
};

module.exports = {
    evaluateRefundEligibility,
    evaluateCancellationEligibility,
    calculateEscalationProbability,
    buildReasoningContext,
    makeDecision,
    logReasoning
};
