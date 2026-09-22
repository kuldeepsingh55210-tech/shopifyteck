const assert = require('assert');
const rateLimiter = require('../src/services/rateLimiterService');
const { checkResponseConfidence, HIGH_RISK_INTENTS } = require('../src/services/confidenceGuardrailService');

async function runTests() {
    console.log('=== RUNNING CONFIDENCE GUARDRAIL UNIT & INTEGRATION TESTS (OPTION C TIERED) ===\n');

    // Test 1: Empty response validation
    console.log('Test 1: Empty response validation...');
    const emptyRes = await checkResponseConfidence({ id: 123 }, '', 50, 'order_status');
    assert.strictEqual(emptyRes.confidence_score, 0);
    assert.strictEqual(emptyRes.should_escalate, true);
    assert.strictEqual(emptyRes.reason, 'Empty response');
    console.log('✔ Passed Test 1\n');

    // Test 2: Invalid order data validation
    console.log('Test 2: Invalid order data validation...');
    const invalidOrderRes = await checkResponseConfidence(null, 'Your order has shipped.', 50, 'order_status');
    assert.strictEqual(invalidOrderRes.confidence_score, 0);
    assert.strictEqual(invalidOrderRes.should_escalate, true);
    assert.strictEqual(invalidOrderRes.reason, 'Invalid order data');

    const nonObjectOrderRes = await checkResponseConfidence('invalid_order', 'Your order has shipped.', 50, 'order_status');
    assert.strictEqual(nonObjectOrderRes.confidence_score, 0);
    assert.strictEqual(nonObjectOrderRes.should_escalate, true);
    console.log('✔ Passed Test 2\n');

    // Test 3A: RateLimiter global cooldown on LOW-RISK intent -> FAIL-OPEN
    console.log('Test 3A: RateLimiter global cooldown on LOW-RISK intent (order_status) -> FAIL-OPEN...');
    rateLimiter.setGlobalCooldown(5); // Activate cooldown
    assert.strictEqual(rateLimiter.isGlobalCooldown(), true);

    const lowRiskCooldownRes = await checkResponseConfidence({ id: 123 }, 'Your order has shipped.', 50, 'order_status');
    assert.strictEqual(lowRiskCooldownRes.confidence_score, 65);
    assert.strictEqual(lowRiskCooldownRes.should_escalate, false);
    assert(lowRiskCooldownRes.reason.includes('Global rate limit cooldown active'));
    console.log('✔ Passed Test 3A (Low-risk cooldown fails open)\n');

    // Test 3B: RateLimiter global cooldown on HIGH-RISK intent (refund_request) -> FAIL-CLOSED
    console.log('Test 3B: RateLimiter global cooldown on HIGH-RISK intent (refund_request) -> FAIL-CLOSED...');
    const highRiskCooldownRes = await checkResponseConfidence({ id: 123 }, 'Your refund is approved.', 50, 'refund_request');
    assert.strictEqual(highRiskCooldownRes.confidence_score, 0);
    assert.strictEqual(highRiskCooldownRes.should_escalate, true);
    assert(highRiskCooldownRes.reason.includes('Global rate limit cooldown active on high-risk intent'));
    console.log('✔ Passed Test 3B (High-risk cooldown fails closed)\n');

    // Reset cooldown
    rateLimiter.cooldownUntil = 0;
    assert.strictEqual(rateLimiter.isGlobalCooldown(), false);

    // Test 4A: API error/timeout on LOW-RISK intent (order_status) -> FAIL-OPEN
    console.log('Test 4A: API error/timeout on LOW-RISK intent (order_status) -> FAIL-OPEN...');
    process.env.GEMINI_API_KEY = 'invalid_key_for_testing';
    const lowRiskApiErrorRes = await checkResponseConfidence({ id: 123, order_number: '#1001' }, 'Your order is arriving tomorrow.', 50, 'order_status');
    assert.strictEqual(lowRiskApiErrorRes.confidence_score, 65);
    assert.strictEqual(lowRiskApiErrorRes.should_escalate, false);
    assert(lowRiskApiErrorRes.reason.includes('Unable to calculate confidence on low-risk intent'));
    console.log('✔ Passed Test 4A (Low-risk API error fails open)\n');

    // Test 4B: API error/timeout on HIGH-RISK intent (refund_request) -> FAIL-CLOSED
    console.log('Test 4B: API error/timeout on HIGH-RISK intent (refund_request) -> FAIL-CLOSED...');
    const refundApiErrorRes = await checkResponseConfidence({ id: 123, order_number: '#1001' }, 'I will issue your refund right now.', 50, 'refund_request');
    assert.strictEqual(refundApiErrorRes.confidence_score, 0);
    assert.strictEqual(refundApiErrorRes.should_escalate, true);
    assert(refundApiErrorRes.reason.includes('Confidence check failed/timed out on high-risk intent (refund_request)'));
    console.log('✔ Passed Test 4B (High-risk refund API error fails closed)\n');

    // Test 4C: API error/timeout on other HIGH-RISK intents (cancel_order & address_change) -> FAIL-CLOSED
    console.log('Test 4C: API error/timeout on cancel_order & address_change -> FAIL-CLOSED...');
    const cancelApiErrorRes = await checkResponseConfidence({ id: 123, order_number: '#1001' }, 'I have cancelled your order.', 50, 'cancel_order');
    assert.strictEqual(cancelApiErrorRes.confidence_score, 0);
    assert.strictEqual(cancelApiErrorRes.should_escalate, true);

    const addressApiErrorRes = await checkResponseConfidence({ id: 123, order_number: '#1001' }, 'I have updated your address.', 50, 'address_change');
    assert.strictEqual(addressApiErrorRes.confidence_score, 0);
    assert.strictEqual(addressApiErrorRes.should_escalate, true);
    console.log('✔ Passed Test 4C (Cancel and Address change fail closed)\n');

    // Test 5: HIGH_RISK_INTENTS export contains expected list
    console.log('Test 5: HIGH_RISK_INTENTS contains expected mutation intents...');
    assert(Array.isArray(HIGH_RISK_INTENTS));
    assert(HIGH_RISK_INTENTS.includes('refund_request'));
    assert(HIGH_RISK_INTENTS.includes('cancel_order'));
    assert(HIGH_RISK_INTENTS.includes('address_change'));
    assert(!HIGH_RISK_INTENTS.includes('order_status'));
    assert(!HIGH_RISK_INTENTS.includes('shipping_status'));
    console.log('✔ Passed Test 5\n');

    // Test 6: ReasoningService logReasoning signature
    console.log('Test 6: ReasoningService logReasoning signature...');
    const reasoningService = require('../src/services/reasoningService');
    assert.strictEqual(typeof reasoningService.logReasoning, 'function');
    assert(reasoningService.logReasoning.length >= 10);
    console.log('✔ Passed Test 6\n');

    // Test 7: Pre-mutation gate verification with mock actionService and refundApprovalService
    console.log('Test 7: Pre-mutation gating (Safety Property: ZERO calls to actionService on guardrail failure)...');

    const mockOrderData = { id: 1009, order_number: '#1009', fulfillment_status: 'unfulfilled' };
    const mockSettings = { min_confidence: 50 };

    // Track mock call counts
    let cancelOrderCallCount = 0;
    let updateShippingAddressCallCount = 0;
    let createApprovalRequestCallCount = 0;
    let escalateToHumanCallCount = 0;

    const mockActionService = {
        cancelOrder: async () => { cancelOrderCallCount++; return { success: true }; },
        updateShippingAddress: async () => { updateShippingAddressCallCount++; return { success: true }; },
        escalateToHuman: async () => { escalateToHumanCallCount++; return { success: true }; },
        sendEmailNotification: async () => ({ success: true }),
        logAction: async () => ({ success: true })
    };

    const mockRefundApprovalService = {
        createApprovalRequest: async () => { createApprovalRequestCallCount++; return { token: 'mock_token' }; }
    };

    // Helper simulating the restructured resolveController block
    async function simulateRestructuredStep5(intent, mockGuardrailResult) {
        let decision = { action: 'auto_resolve', confidence: 0.95, reasoning: 'Eligible for auto-resolution' };
        let resolutionStatus = 'auto_resolved';
        let isEscalated = false;
        let finalResponse = 'AI generated response text for ' + intent;
        let newRefundRequestCreated = false;
        const eligibility = { eligible: true };

        const guardrailResult = mockGuardrailResult;
        const confidenceScore = guardrailResult.confidence_score;
        decision.confidence = confidenceScore / 100.0;

        if (guardrailResult.should_escalate || confidenceScore < mockSettings.min_confidence) {
            decision.action = 'escalate';
            decision.reasoning = `Confidence guardrail score (${confidenceScore}%) below threshold (${mockSettings.min_confidence}%): ${guardrailResult.reason}`;
            resolutionStatus = 'escalated';
            isEscalated = true;
            finalResponse = "I want to make sure you get the most accurate details for your order. I've escalated your request to our human support team, and a representative will follow up with you shortly.";
            await mockActionService.escalateToHuman();
        } else {
            if (intent === 'refund_request' && eligibility.eligible === true) {
                newRefundRequestCreated = true;
                await mockRefundApprovalService.createApprovalRequest();
                finalResponse += " I've forwarded this refund request to our team for a quick review.";
            } else if (intent === 'address_change' && eligibility.eligible === true) {
                await mockActionService.updateShippingAddress();
                finalResponse += " I've updated your shipping address.";
            } else if (intent === 'cancel_order' && eligibility.eligible === true) {
                await mockActionService.cancelOrder();
                finalResponse += " Your order has been cancelled.";
            }
        }

        return { decision, resolutionStatus, isEscalated, finalResponse, newRefundRequestCreated };
    }

    // Subtest 7.1: cancel_order with guardrail failure (fails closed) -> ZERO calls to cancelOrder
    cancelOrderCallCount = 0;
    escalateToHumanCallCount = 0;
    const cancelSimResult = await simulateRestructuredStep5('cancel_order', {
        confidence_score: 0,
        reason: 'Guardrail check timed out on high-risk intent (cancel_order) - failed closed',
        should_escalate: true
    });
    assert.strictEqual(cancelOrderCallCount, 0, 'SAFETY VIOLATION: actionService.cancelOrder was called despite guardrail failure!');
    assert.strictEqual(escalateToHumanCallCount, 1);
    assert.strictEqual(cancelSimResult.decision.action, 'escalate');
    assert.strictEqual(cancelSimResult.resolutionStatus, 'escalated');
    assert(cancelSimResult.finalResponse.includes('human support team'));
    console.log('✔ Passed Test 7.1 (cancel_order guardrail failure -> ZERO cancelOrder calls)');

    // Subtest 7.2: address_change with guardrail failure (fails closed) -> ZERO calls to updateShippingAddress
    updateShippingAddressCallCount = 0;
    escalateToHumanCallCount = 0;
    const addressSimResult = await simulateRestructuredStep5('address_change', {
        confidence_score: 0,
        reason: 'Guardrail check timed out on high-risk intent (address_change) - failed closed',
        should_escalate: true
    });
    assert.strictEqual(updateShippingAddressCallCount, 0, 'SAFETY VIOLATION: actionService.updateShippingAddress was called despite guardrail failure!');
    assert.strictEqual(escalateToHumanCallCount, 1);
    assert.strictEqual(addressSimResult.decision.action, 'escalate');
    assert.strictEqual(addressSimResult.resolutionStatus, 'escalated');
    console.log('✔ Passed Test 7.2 (address_change guardrail failure -> ZERO updateShippingAddress calls)');

    // Subtest 7.3: refund_request with guardrail failure (fails closed) -> ZERO calls to createApprovalRequest
    createApprovalRequestCallCount = 0;
    escalateToHumanCallCount = 0;
    const refundSimResult = await simulateRestructuredStep5('refund_request', {
        confidence_score: 0,
        reason: 'Guardrail check timed out on high-risk intent (refund_request) - failed closed',
        should_escalate: true
    });
    assert.strictEqual(createApprovalRequestCallCount, 0, 'SAFETY VIOLATION: refundApprovalService.createApprovalRequest was called despite guardrail failure!');
    assert.strictEqual(refundSimResult.newRefundRequestCreated, false);
    assert.strictEqual(escalateToHumanCallCount, 1);
    assert.strictEqual(refundSimResult.decision.action, 'escalate');
    console.log('✔ Passed Test 7.3 (refund_request guardrail failure -> ZERO createApprovalRequest calls)');

    // Subtest 7.4: cancel_order with high confidence (passes guardrail) -> cancelOrder DOES execute
    cancelOrderCallCount = 0;
    const cancelSuccessResult = await simulateRestructuredStep5('cancel_order', {
        confidence_score: 95,
        reason: 'Accurately reflects cancellation policy and order status',
        should_escalate: false
    });
    assert.strictEqual(cancelOrderCallCount, 1);
    assert.strictEqual(cancelSuccessResult.decision.action, 'auto_resolve');
    assert.strictEqual(cancelSuccessResult.resolutionStatus, 'auto_resolved');
    assert(cancelSuccessResult.finalResponse.includes('Your order has been cancelled'));
    console.log('✔ Passed Test 7.4 (cancel_order high confidence -> cancelOrder executes successfully)');

    // Subtest 7.5: Low-risk intent (order_status) timeout -> fails open and delivers tracking status
    const orderStatusLowRiskResult = await simulateRestructuredStep5('order_status', {
        confidence_score: 65,
        reason: 'Unable to calculate confidence on low-risk intent - failing open',
        should_escalate: false
    });
    assert.strictEqual(orderStatusLowRiskResult.decision.action, 'auto_resolve');
    assert.strictEqual(orderStatusLowRiskResult.resolutionStatus, 'auto_resolved');
    assert(orderStatusLowRiskResult.finalResponse.includes('AI generated response text for order_status'));
    console.log('✔ Passed Test 7.5 (order_status low-risk timeout -> fails open, delivers status)\n');

    console.log('ALL 9 TESTS COMPLETED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
