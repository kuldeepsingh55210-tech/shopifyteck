const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

// Signup controller
const signup = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Validation checks
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields (name, email, phone, password) are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Check if merchant already exists
        const existingMerchant = await db.query('SELECT id FROM merchants WHERE email = $1', [email]);
        if (existingMerchant.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert merchant
        const result = await db.query(
            `INSERT INTO merchants (name, email, phone, password_hash) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, name, email`,
            [name, email, phone, passwordHash]
        );

        const newMerchant = result.rows[0];

        // Generate JWT
        const token = jwt.sign(
            { merchantId: newMerchant.id, email: newMerchant.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            merchant: {
                id: newMerchant.id,
                name: newMerchant.name,
                email: newMerchant.email
            }
        });
    } catch (error) {
        console.error('[Auth Controller] Signup error:', error.message);
        res.status(500).json({ error: 'Internal server error during signup' });
    }
};

// Login controller
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Lookup merchant
        const result = await db.query(
            'SELECT id, name, email, password_hash, shop_domain FROM merchants WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const merchant = result.rows[0];

        // Compare password
        const passwordMatch = await bcrypt.compare(password, merchant.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { merchantId: merchant.id, email: merchant.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            token,
            merchant: {
                id: merchant.id,
                name: merchant.name,
                email: merchant.email,
                shop_domain: merchant.shop_domain
            }
        });
    } catch (error) {
        console.error('[Auth Controller] Login error:', error.message);
        res.status(500).json({ error: 'Internal server error during login' });
    }
};

// Get current merchant profile
const getMe = async (req, res) => {
    try {
        const merchantId = req.merchant.merchantId;

        const result = await db.query(
            'SELECT id, name, email, phone, shop_domain, created_at FROM merchants WHERE id = $1',
            [merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Merchant profile not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('[Auth Controller] getMe error:', error.message);
        res.status(500).json({ error: 'Internal server error fetching profile' });
    }
};

// Link active shop channel
const linkShop = async (req, res) => {
    try {
        const { shop_domain } = req.body;
        const merchantId = req.merchant.merchantId;

        if (!shop_domain) {
            return res.status(400).json({ error: 'shop_domain parameter is required' });
        }

        // Verify shop exists in the shops database
        const shopCheck = await db.query(
            'SELECT id, shop_domain FROM shops WHERE shop_domain = $1 AND is_active = true',
            [shop_domain]
        );

        if (shopCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Shop domain not found or inactive' });
        }

        const shop = shopCheck.rows[0];

        // Update merchant fields
        const result = await db.query(
            `UPDATE merchants 
             SET shop_id = $1, shop_domain = $2, updated_at = NOW() 
             WHERE id = $3 
             RETURNING id, name, email, phone, shop_domain`,
            [shop.id, shop.shop_domain, merchantId]
        );

        res.status(200).json({
            success: true,
            merchant: result.rows[0]
        });
    } catch (error) {
        console.error('[Auth Controller] linkShop error:', error.message);
        res.status(500).json({ error: 'Internal server error linking shop channel' });
    }
};

module.exports = {
    signup,
    login,
    getMe,
    linkShop
};
