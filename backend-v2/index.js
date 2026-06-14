require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./src/middleware/errorHandler');
const verifyShop = require('./src/middleware/verifyShop');
const verifySessionToken = require('./src/middleware/verifySessionToken');
const db = require('./src/db/db');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:8080'
        ].filter(Boolean);

        // Allow requests with no origin (mobile apps, curl, Shopify webhooks)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Capture raw body for webhook signature validation
app.use((req, res, next) => {
    if (req.path.startsWith('/webhooks')) {
        express.raw({ type: 'application/json' })(req, res, () => {
            req.rawBody = req.body.toString('utf-8');
            express.json()(req, res, next);
        });
    } else {
        express.json()(req, res, next);
    }
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes
const ticketsRoute = require('./src/routes/tickets');
const shopifyRoute = require('./src/routes/shopify');
const apiRoute = require('./src/routes/api');
const webhooksRoute = require('./src/routes/webhooks');
const { resolveOrder } = require('./src/controllers/resolveController');
const authRoutes = require('./src/routes/auth');

app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        console.error('[Health] Database check failed:', error.message);
        res.status(503).json({ 
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            database: 'disconnected'
        });
    }
});

app.get('/success', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard`);
});

app.use('/api/tickets', verifySessionToken, ticketsRoute);
app.use('/shopify', shopifyRoute);
app.use('/api', verifySessionToken, apiRoute);
app.use('/webhooks', webhooksRoute);
app.use('/api/auth', authRoutes);
app.post('/resolve-order', verifySessionToken, resolveOrder);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

module.exports = app;