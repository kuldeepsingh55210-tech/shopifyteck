const express = require('express');
const router = express.Router();
const { showConfirmationPage, approveRefund, rejectRefund } = require('../controllers/refundApprovalController');

// GET /refund-approval/:token -> Safe, read-only confirmation page
router.get('/:token', showConfirmationPage);

// Legacy GET redirects to prevent bot/crawler pre-fetching from triggering refunds
router.get('/:token/approve', (req, res) => res.redirect(`/refund-approval/${req.params.token}`));
router.get('/:token/reject', (req, res) => res.redirect(`/refund-approval/${req.params.token}`));

// POST /refund-approval/:token/* -> Action execution endpoints
router.post('/:token/approve', approveRefund);
router.post('/:token/reject', rejectRefund);

module.exports = router;
