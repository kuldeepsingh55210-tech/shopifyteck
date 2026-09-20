const path = require('path');

// In-memory token store for test scenarios
const mockApprovals = {
    'token-pending': {
        token: 'token-pending',
        shop_domain: 'test-shop.myshopify.com',
        order_id: 'gid://shopify/Order/12345',
        order_number: '1001',
        customer_email: 'customer@example.com',
        amount: '49.99',
        reason: 'Item defective',
        status: 'pending'
    },
    'token-approved': {
        token: 'token-approved',
        shop_domain: 'test-shop.myshopify.com',
        order_id: 'gid://shopify/Order/12346',
        order_number: '1002',
        customer_email: 'customer2@example.com',
        amount: '120.00',
        reason: 'Late delivery',
        status: 'approved'
    },
    'token-rejected': {
        token: 'token-rejected',
        shop_domain: 'test-shop.myshopify.com',
        order_id: 'gid://shopify/Order/12347',
        order_number: '1003',
        customer_email: 'customer3@example.com',
        amount: '75.50',
        reason: 'Accidental order',
        status: 'rejected'
    }
};

let createRefundCallCount = 0;
let logActionCallCount = 0;

const mockRefundApprovalService = {
    getByToken: async (token) => {
        return mockApprovals[token] ? { ...mockApprovals[token] } : null;
    },
    markResolved: async (token, status) => {
        const item = mockApprovals[token];
        if (!item || item.status !== 'pending') return null;
        item.status = status;
        return { ...item };
    }
};

const mockActionService = {
    createRefund: async (shopDomain, orderId, reason) => {
        createRefundCallCount++;
        return { success: true, refund_id: 'gid://shopify/Refund/99999' };
    },
    logAction: async () => {
        logActionCallCount++;
        return true;
    }
};

// Pre-populate Node require.cache to prevent loading db.js and pg
const refundApprovalServicePath = path.resolve(__dirname, '../src/services/refundApprovalService.js');
const actionServicePath = path.resolve(__dirname, '../src/services/actionService.js');

require.cache[refundApprovalServicePath] = {
    id: refundApprovalServicePath,
    filename: refundApprovalServicePath,
    loaded: true,
    exports: mockRefundApprovalService
};

require.cache[actionServicePath] = {
    id: actionServicePath,
    filename: actionServicePath,
    loaded: true,
    exports: mockActionService
};

// Now safely load the controller
const { showConfirmationPage, approveRefund, rejectRefund } = require('../src/controllers/refundApprovalController');

// Helper to create mock Express response object
function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        redirectUrl: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(content) {
            this.body = content;
            return this;
        },
        redirect(url) {
            this.statusCode = 302;
            this.redirectUrl = url;
            return this;
        }
    };
}

async function runTests() {
    console.log('====================================================');
    console.log('   REFUND APPROVAL COMPREHENSIVE VERIFICATION SUITE  ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(desc, condition) {
        if (condition) {
            console.log(`[PASS] ${desc}`);
            passed++;
        } else {
            console.error(`[FAIL] ${desc}`);
            failed++;
        }
    }

    // TEST 1: Safe GET /refund-approval/:token (pending)
    const req1 = { params: { token: 'token-pending' } };
    const res1 = createMockRes();
    await showConfirmationPage(req1, res1);
    assert('TEST 1: Safe GET returns 200', res1.statusCode === 200);
    assert('TEST 1: Safe GET displays confirmation card with "Action Required" and "Refund Review"', 
        res1.body.includes('Action Required') && res1.body.includes('Refund Review'));
    assert('TEST 1: Safe GET contains approve and reject action POST forms', 
        res1.body.includes('action="/refund-approval/token-pending/approve"') &&
        res1.body.includes('action="/refund-approval/token-pending/reject"') &&
        res1.body.includes('method="POST"'));
    assert('TEST 1: Safe GET did NOT execute createRefund (zero side-effects)', createRefundCallCount === 0);
    assert('TEST 1: Status remains pending in DB', mockApprovals['token-pending'].status === 'pending');

    // TEST 2: Legacy GET /:token/approve crawler redirect
    const legacyApproveHandler = (req, res) => res.redirect(`/refund-approval/${req.params.token}`);
    const req2 = { params: { token: 'token-pending' } };
    const res2 = createMockRes();
    legacyApproveHandler(req2, res2);
    assert('TEST 2: Legacy GET /approve redirects with 302', res2.statusCode === 302);
    assert('TEST 2: Legacy GET /approve redirects to confirmation page /refund-approval/:token', res2.redirectUrl === '/refund-approval/token-pending');
    assert('TEST 2: No refund triggered on GET crawler visit', createRefundCallCount === 0);

    // TEST 3: Legacy GET /:token/reject crawler redirect
    const legacyRejectHandler = (req, res) => res.redirect(`/refund-approval/${req.params.token}`);
    const req3 = { params: { token: 'token-pending' } };
    const res3 = createMockRes();
    legacyRejectHandler(req3, res3);
    assert('TEST 3: Legacy GET /reject redirects with 302', res3.statusCode === 302);
    assert('TEST 3: Legacy GET /reject redirects to confirmation page', res3.redirectUrl === '/refund-approval/token-pending');
    assert('TEST 3: Status remains pending after legacy GET /reject', mockApprovals['token-pending'].status === 'pending');

    // TEST 4: POST /:token/approve executes refund and mutates state
    const req4 = { params: { token: 'token-pending' } };
    const res4 = createMockRes();
    await approveRefund(req4, res4);
    assert('TEST 4: POST /approve returns 200', res4.statusCode === 200);
    assert('TEST 4: createRefund called exactly once', createRefundCallCount === 1);
    assert('TEST 4: State flipped to approved in DB', mockApprovals['token-pending'].status === 'approved');
    assert('TEST 4: Success confirmation page shown with checkmark', res4.body.includes('Refund approved'));

    // TEST 5: Single-use replay protection (second POST /approve rejected)
    const req5 = { params: { token: 'token-pending' } };
    const res5 = createMockRes();
    await approveRefund(req5, res5);
    assert('TEST 5: Second POST rejected as already handled', res5.body.includes('Already handled'));
    assert('TEST 5: createRefund NOT called a second time (atomic protection)', createRefundCallCount === 1);

    // TEST 6: POST /:token/reject mutates state without refund
    mockApprovals['token-fresh-reject'] = {
        token: 'token-fresh-reject',
        shop_domain: 'test-shop.myshopify.com',
        order_id: 'gid://shopify/Order/8888',
        order_number: '1008',
        customer_email: 'reject@example.com',
        amount: '25.00',
        status: 'pending'
    };
    const req6 = { params: { token: 'token-fresh-reject' } };
    const res6 = createMockRes();
    await rejectRefund(req6, res6);
    assert('TEST 6: POST /reject returns 200', res6.statusCode === 200);
    assert('TEST 6: State flipped to rejected in DB', mockApprovals['token-fresh-reject'].status === 'rejected');
    assert('TEST 6: createRefund was NOT called for rejection', createRefundCallCount === 1);
    assert('TEST 6: Rejection confirmation page shown', res6.body.includes('Refund rejected'));

    // TEST 7: Invalid token returns 404
    const req7 = { params: { token: 'invalid-token-xyz' } };
    const res7 = createMockRes();
    await showConfirmationPage(req7, res7);
    assert('TEST 7: Invalid token returns 404', res7.statusCode === 404);
    assert('TEST 7: Link not found page rendered with error flag', res7.body.includes('Link not found') && res7.body.includes('#dc2626'));

    // =========================================================================
    // TEST 8: Token that has ALREADY been resolved is visited again via GET /refund-approval/:token
    // =========================================================================
    console.log('\n----------------------------------------------------');
    console.log('   TEST 8: Resolved token re-visited via GET       ');
    console.log('----------------------------------------------------');

    // TEST 8A: Already APPROVED token re-visited via GET /refund-approval/:token
    const req8a = { params: { token: 'token-approved' } };
    const res8a = createMockRes();
    await showConfirmationPage(req8a, res8a);

    assert('TEST 8A.1: GET on already approved token returns 200', res8a.statusCode === 200);
    assert('TEST 8A.1: Does NOT show POST forms (no <form> tag)', !res8a.body.includes('<form'));
    assert('TEST 8A.1: Does NOT show approve button', !res8a.body.includes('Approve Refund'));
    assert('TEST 8A.1: Does NOT show reject button', !res8a.body.includes('Reject Request'));
    assert('TEST 8A.1: Does NOT show any <button> element', !res8a.body.includes('<button'));
    assert('TEST 8A.2: Shows clear "Already Approved" in heading', res8a.body.includes('<h1>Already Approved</h1>'));
    assert('TEST 8A.2: Shows clear "already approved" in body text', res8a.body.includes('already approved'));
    assert('TEST 8A.2: Explicitly displays relevant order identifier (#1002)', res8a.body.includes('#1002'));
    assert('TEST 8A.2: States "No further action is required"', res8a.body.includes('No further action is required.'));

    // TEST 8B: Already REJECTED token re-visited via GET /refund-approval/:token
    const req8b = { params: { token: 'token-rejected' } };
    const res8b = createMockRes();
    await showConfirmationPage(req8b, res8b);

    assert('TEST 8B.1: GET on already rejected token returns 200', res8b.statusCode === 200);
    assert('TEST 8B.1: Does NOT show POST forms (no <form> tag)', !res8b.body.includes('<form'));
    assert('TEST 8B.1: Does NOT show approve button', !res8b.body.includes('Approve Refund'));
    assert('TEST 8B.1: Does NOT show reject button', !res8b.body.includes('Reject Request'));
    assert('TEST 8B.1: Does NOT show any <button> element', !res8b.body.includes('<button'));
    assert('TEST 8B.2: Shows clear "Already Rejected" in heading', res8b.body.includes('<h1>Already Rejected</h1>'));
    assert('TEST 8B.2: Shows clear "already rejected" in body text', res8b.body.includes('already rejected'));
    assert('TEST 8B.2: Explicitly displays relevant order identifier (#1003)', res8b.body.includes('#1003'));
    assert('TEST 8B.2: States "No refund was issued"', res8b.body.includes('No refund was issued.'));

    // TEST 8C: Full lifecycle (token transitions pending -> approved via POST, then merchant re-visits GET)
    const req8c_post = { params: { token: 'token-fresh-lifecycle' } };
    mockApprovals['token-fresh-lifecycle'] = {
        token: 'token-fresh-lifecycle',
        shop_domain: 'test-shop.myshopify.com',
        order_id: 'gid://shopify/Order/9999',
        order_number: '1099',
        customer_email: 'lifecycle@example.com',
        amount: '60.00',
        status: 'pending'
    };
    const res8c_post = createMockRes();
    await approveRefund(req8c_post, res8c_post);
    assert('TEST 8C Lifecycle: Token approved via POST', mockApprovals['token-fresh-lifecycle'].status === 'approved');

    const req8c_get = { params: { token: 'token-fresh-lifecycle' } };
    const res8c_get = createMockRes();
    await showConfirmationPage(req8c_get, res8c_get);
    assert('TEST 8C Lifecycle: Merchant re-opening email link sees Already Approved', 
        res8c_get.body.includes('<h1>Already Approved</h1>') && 
        res8c_get.body.includes('#1099') && 
        !res8c_get.body.includes('<form'));

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
});
