const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyMerchant = require('../middleware/verifyMerchant');

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', verifyMerchant, authController.getMe);
router.post('/link-shop', verifyMerchant, authController.linkShop);

module.exports = router;
