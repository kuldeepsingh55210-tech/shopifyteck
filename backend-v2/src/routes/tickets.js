const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/ticketsController');

// Saare tickets lao
router.get('/', ticketsController.getAllTickets);

// Naya ticket banao
router.post('/', ticketsController.createTicket);

// Ticket resolve karo
router.post('/:id/resolve', ticketsController.resolveTicket);

module.exports = router;