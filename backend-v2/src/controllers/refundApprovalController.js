const refundApprovalService = require('../services/refundApprovalService');
const actionService = require('../services/actionService');

const renderPage = (title, message, isError = false) => `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 420px; text-align: center; }
    h1 { font-size: 20px; color: ${isError ? '#dc2626' : '#111'}; margin-bottom: 12px; }
    p { color: #555; line-height: 1.5; }
  </style>
</head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body>
</html>`;

const renderConfirmationPage = (approval) => {
    const formattedAmount = approval.amount ? `$${Number(approval.amount).toFixed(2)}` : 'Full Order Amount';
    const orderDisplay = approval.order_number ? `#${approval.order_number}` : `ID: ${approval.order_id}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Confirm Refund Request — ${orderDisplay}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #fff; padding: 36px 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 480px; width: 100%; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; background: #fef3c7; color: #b45309; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    p.subtitle { color: #64748b; font-size: 14px; margin: 0 0 24px 0; line-height: 1.4; }
    .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; max-width: 60%; }
    .actions { display: flex; gap: 12px; margin-top: 8px; }
    form { flex: 1; margin: 0; }
    button { width: 100%; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s ease; }
    .btn-approve { background: #16a34a; color: #ffffff; }
    .btn-approve:hover { background: #15803d; }
    .btn-reject { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .btn-reject:hover { background: #e2e8f0; color: #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Action Required</span>
    <h1>Refund Review</h1>
    <p class="subtitle">Please confirm whether you want to approve or reject this customer refund.</p>
    
    <div class="details">
      <div class="row"><span class="label">Order</span><span class="value">${orderDisplay}</span></div>
      <div class="row"><span class="label">Customer</span><span class="value">${approval.customer_email || 'N/A'}</span></div>
      <div class="row"><span class="label">Amount</span><span class="value">${formattedAmount}</span></div>
      <div class="row"><span class="label">Reason</span><span class="value">${approval.reason || 'Customer requested via chat'}</span></div>
      <div class="row"><span class="label">Store</span><span class="value">${approval.shop_domain || 'Shopify Store'}</span></div>
    </div>

    <div class="actions">
      <form method="POST" action="/refund-approval/${approval.token}/reject">
        <button type="submit" class="btn-reject">Reject Request</button>
      </form>
      <form method="POST" action="/refund-approval/${approval.token}/approve">
        <button type="submit" class="btn-approve">Approve Refund</button>
      </form>
    </div>
  </div>
</body>
</html>`;
};

// GET /refund-approval/:token (Safe, read-only confirmation page)
const showConfirmationPage = async (req, res) => {
    const { token } = req.params;
    const approval = await refundApprovalService.getByToken(token);

    if (!approval) {
        return res.status(404).send(renderPage('Link not found', 'This refund approval link is invalid or has expired.', true));
    }
    if (approval.status !== 'pending') {
        const isApproved = approval.status === 'approved';
        const isRejected = approval.status === 'rejected';
        const title = isApproved ? 'Already Approved' : (isRejected ? 'Already Rejected' : 'Already Handled');
        const orderDisplay = approval.order_number ? `#${approval.order_number}` : (approval.order_id ? `ID: ${approval.order_id}` : '');
        const orderSuffix = orderDisplay ? ` for order ${orderDisplay}` : '';
        const message = isApproved
            ? `This refund request was already approved${orderSuffix}. No further action is required.`
            : (isRejected
                ? `This refund request was already rejected${orderSuffix}. No refund was issued.`
                : `This refund request was already marked as "${approval.status}". No further action was taken.`);
        return res.send(renderPage(title, message));
    }

    return res.send(renderConfirmationPage(approval));
};

// POST /refund-approval/:token/approve (State mutation and Shopify execution)
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

// POST /refund-approval/:token/reject (State mutation)
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

module.exports = { showConfirmationPage, approveRefund, rejectRefund };
