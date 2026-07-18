const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: { type: String, required: true, unique: true }, // Format: T-XXXX
    channelId: { type: String, required: true },
    creatorId: { type: String, required: true },
    ticketType: { type: String, enum: ['SUPPORT', 'WARRANTY'], required: true },
    productName: { type: String, default: null },
    purchaseDate: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SupportTicket', ticketSchema);
