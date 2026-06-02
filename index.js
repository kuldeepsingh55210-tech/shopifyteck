require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Routes
const ticketsRoute = require('./src/routes/tickets');
const shopifyRoute = require('./src/routes/shopify');
const apiRoute = require('./src/routes/api');
const { resolveOrder } = require('./src/controllers/resolveController');

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/tickets', ticketsRoute);
app.use('/shopify', shopifyRoute);
app.use('/api', apiRoute);
app.post('/resolve-order', resolveOrder);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));