const express = require('express');
const router = express.Router();
const validateWebhookSignature = require('../middleware/validateWebhookSignature');
const { handleOrderCreate, handleOrderUpdated, handleAppUninstalled } = require('../controllers/webhookController');

// All webhook endpoints use signature validation
router.use(validateWebhookSignature);

// Webhook endpoints
router.post('/orders_create', handleOrderCreate);
router.post('/orders_updated', handleOrderUpdated);
router.post('/app_uninstalled', handleAppUninstalled);

module.exports = router;
