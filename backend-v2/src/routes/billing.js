const express = require('express');
const router = express.Router();
const verifySessionToken = require('../middleware/verifySessionToken');
const db = require('../db/db');

// Pricing Plans
const PLANS = {
  starter: {
    name: 'Starter',
    monthly_price: 99.00,
    annual_price: 990.00,
    tickets_limit: 1500,
    features: ['1,500 tickets/month', 'AI Memory Engine', 'Hinglish Support', 'Analytics Dashboard', 'Email Support']
  },
  growth: {
    name: 'Growth',
    monthly_price: 199.00,
    annual_price: 1990.00,
    tickets_limit: 3500,
    features: ['3,500 tickets/month', 'Everything in Starter', 'Fraud Detection', 'VIP Customer Detection', 'Priority Support']
  },
  pro: {
    name: 'Pro',
    monthly_price: 349.00,
    annual_price: 3490.00,
    tickets_limit: -1,
    features: ['Unlimited tickets', 'Everything in Growth', 'White-label Widget', 'SLA Guarantee', 'Dedicated Support']
  }
};

// GET /api/billing/plans
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: PLANS,
    free_tier: {
      name: 'Free',
      tickets_limit: 50,
      features: ['50 tickets/month', 'Basic AI', 'Chat Widget']
    }
  });
});

// POST /api/billing/create
router.post('/create', verifySessionToken, async (req, res) => {
  try {
    const { plan, billing_cycle } = req.body;
    const shop_domain = req.shop_domain || req.body.shop_domain;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const selectedPlan = PLANS[plan];
    const price = billing_cycle === 'annual' ? selectedPlan.annual_price : selectedPlan.monthly_price;

    const shopResult = await db.query(
      'SELECT access_token FROM shops WHERE shop_domain = $1',
      [shop_domain]
    );

    if (!shopResult.rows[0]) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
    const [ivHex, encrypted] = shopResult.rows[0].access_token.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let accessToken = decipher.update(encrypted, 'hex', 'utf8');
    accessToken += decipher.final('utf8');

    const shopifyResponse = await fetch(
      `https://${shop_domain}/admin/api/2024-01/recurring_application_charges.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recurring_application_charge: {
            name: `ORYQX AutoSupport AI — ${selectedPlan.name}`,
            price: price,
            return_url: `${process.env.APP_URL}/api/billing/confirm?shop=${shop_domain}&plan=${plan}&cycle=${billing_cycle}`,
            trial_days: 14,
            test: false
          }
        })
      }
    );

    const chargeData = await shopifyResponse.json();

    if (!chargeData.recurring_application_charge) {
      return res.status(500).json({ error: 'Failed to create charge', details: chargeData });
    }

    const charge = chargeData.recurring_application_charge;

    await db.query(
      `INSERT INTO billing_subscriptions 
       (shop_domain, plan, billing_cycle, charge_id, status, price, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
       ON CONFLICT (shop_domain) DO UPDATE SET
       plan = $2, billing_cycle = $3, charge_id = $4, status = 'pending', price = $5`,
      [shop_domain, plan, billing_cycle, charge.id, price]
    );

    res.json({
      success: true,
      confirmation_url: charge.confirmation_url,
      charge_id: charge.id
    });

  } catch (error) {
    console.error('[Billing] Create charge error:', error);
    res.status(500).json({ error: 'Billing creation failed' });
  }
});

// GET /api/billing/confirm
router.get('/confirm', async (req, res) => {
  try {
    const { shop, plan, cycle, charge_id } = req.query;

    const shopResult = await db.query(
      'SELECT access_token FROM shops WHERE shop_domain = $1',
      [shop]
    );

    if (!shopResult.rows[0]) {
      return res.redirect(`${process.env.FRONTEND_URL}/billing?error=shop_not_found`);
    }

    const crypto = require('crypto');
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex');
    const [ivHex, encrypted] = shopResult.rows[0].access_token.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let accessToken = decipher.update(encrypted, 'hex', 'utf8');
    accessToken += decipher.final('utf8');

    const activateRes = await fetch(
      `https://${shop}/admin/api/2024-01/recurring_application_charges/${charge_id}/activate.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    const activateData = await activateRes.json();

    if (activateData.recurring_application_charge?.status === 'active') {
      await db.query(
        `UPDATE billing_subscriptions SET status = 'active', activated_at = NOW() 
         WHERE shop_domain = $1 AND charge_id = $2`,
        [shop, charge_id]
      );

      await db.query(
        `UPDATE shops SET plan = $1, plan_activated_at = NOW() WHERE shop_domain = $2`,
        [plan, shop]
      );

      return res.redirect(`${process.env.FRONTEND_URL}?shop=${shop}&billing=success&plan=${plan}`);
    }

    res.redirect(`${process.env.FRONTEND_URL}?shop=${shop}&billing=failed`);

  } catch (error) {
    console.error('[Billing] Confirm error:', error);
    res.redirect(`${process.env.FRONTEND_URL}?billing=error`);
  }
});

// GET /api/billing/status
router.get('/status', verifySessionToken, async (req, res) => {
  try {
    const shop_domain = req.shop_domain;

    const result = await db.query(
      'SELECT * FROM billing_subscriptions WHERE shop_domain = $1',
      [shop_domain]
    );

    if (!result.rows[0]) {
      return res.json({
        success: true,
        plan: 'free',
        tickets_limit: 50,
        status: 'free'
      });
    }

    const sub = result.rows[0];
    const planDetails = PLANS[sub.plan] || {};

    res.json({
      success: true,
      plan: sub.plan,
      billing_cycle: sub.billing_cycle,
      status: sub.status,
      price: sub.price,
      tickets_limit: planDetails.tickets_limit || 50,
      activated_at: sub.activated_at
    });

  } catch (error) {
    console.error('[Billing] Status error:', error);
    res.status(500).json({ error: 'Failed to get billing status' });
  }
});

// POST /api/billing/cancel
router.post('/cancel', verifySessionToken, async (req, res) => {
  try {
    const shop_domain = req.shop_domain;

    await db.query(
      `UPDATE billing_subscriptions SET status = 'cancelled', cancelled_at = NOW() 
       WHERE shop_domain = $1`,
      [shop_domain]
    );

    await db.query(
      `UPDATE shops SET plan = 'free' WHERE shop_domain = $1`,
      [shop_domain]
    );

    res.json({ success: true, message: 'Subscription cancelled' });

  } catch (error) {
    console.error('[Billing] Cancel error:', error);
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

module.exports = router;
