const express = require('express');
const router = express.Router();
const { approveRefund, rejectRefund } = require('../controllers/refundApprovalController');

router.get('/:token/approve', approveRefund);
router.get('/:token/reject', rejectRefund);

module.exports = router;
