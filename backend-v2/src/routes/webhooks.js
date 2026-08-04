const express = require('express');
const router = express.Router();
const validateWebhookSignature = require('../middleware/validateWebhookSignature');
const {
    handleOrderCreate,
    handleOrderUpdated,
    handleAppUninstalled,
    handleCustomersDataRequest,
    handleCustomersRedact,
    handleShopRedact
} = require('../controllers/webhookController');

// All webhook endpoints use signature validation
router.use(validateWebhookSignature);

// Webhook endpoints
router.post('/orders_create', handleOrderCreate);
router.post('/orders_updated', handleOrderUpdated);
router.post('/app_uninstalled', handleAppUninstalled);

// Mandatory GDPR compliance webhooks (required for Shopify App Store approval)
router.post('/customers_data_request', handleCustomersDataRequest);
router.post('/customers_redact', handleCustomersRedact);
router.post('/shop_redact', handleShopRedact);

module.exports = router;
