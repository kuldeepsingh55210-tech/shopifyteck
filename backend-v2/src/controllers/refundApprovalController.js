const refundApprovalService = require('../services/refundApprovalService');
const actionService = require('../services/actionService');

const renderPage = (title, message, isError = false) => `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 420px; text-align: center; }
    h1 { font-size: 20px; color: ${isError ? '#dc2626' : '#111'}; margin-bottom: 12px; }
    p { color: #555; line-height: 1.5; }
  </style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`;

const approveRefund = async (req, res) => {
    const { token } = req.params;
    const approval = await refundApprovalService.getByToken(token);

    if (!approval) {
        return res.status(404).send(renderPage('Link not found', 'This refund approval link is invalid or has expired.', true));
    }
    if (approval.status !== 'pending') {
        return res.send(renderPage('Already handled', `This refund request was already marked as "${approval.status}". No further action was taken.`));
    }

    // Atomic flip pending -> approved. If this returns null, someone else (e.g. a double-click) already resolved it.
    const resolved = await refundApprovalService.markResolved(token, 'approved');
    if (!resolved) {
        return res.send(renderPage('Already handled', 'This refund request was already processed.'));
    }

    const result = await actionService.createRefund(resolved.shop_domain, resolved.order_id, resolved.reason || 'Merchant-approved refund via ORYQX');
    await actionService.logAction(resolved.shop_domain, resolved.customer_email, null, 'refund', { order: resolved.order_id, approved_via_email: true }, result.success, result.error);

    if (!result.success) {
        return res.send(renderPage(
            'Approved, but refund failed',
            `The request was marked approved, but Shopify returned an error while processing it. Please process this refund manually in Shopify Admin for order ${resolved.order_number || resolved.order_id}.`,
            true
        ));
    }

    return res.send(renderPage('Refund approved \u2705', `The refund for order ${resolved.order_number || resolved.order_id} has been processed. Refund ID: ${result.refund_id}.`));
};

const rejectRefund = async (req, res) => {
    const { token } = req.params;
    const approval = await refundApprovalService.getByToken(token);

    if (!approval) {
        return res.status(404).send(renderPage('Link not found', 'This refund approval link is invalid or has expired.', true));
    }
    if (approval.status !== 'pending') {
        return res.send(renderPage('Already handled', `This refund request was already marked as "${approval.status}". No further action was taken.`));
    }

    const resolved = await refundApprovalService.markResolved(token, 'rejected');
    if (!resolved) {
        return res.send(renderPage('Already handled', 'This refund request was already processed.'));
    }

    await actionService.logAction(resolved.shop_domain, resolved.customer_email, null, 'refund_rejected', { order: resolved.order_id }, true);

    return res.send(renderPage('Refund rejected', `The refund request for order ${resolved.order_number || resolved.order_id} has been marked as rejected. No refund was issued.`));
};

module.exports = { approveRefund, rejectRefund };
