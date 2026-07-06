const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    note: { type: String, default: 'Không có ghi chú' },
    date: { type: String, required: true },
    addedBy: { type: String, required: true },
}, { _id: false });

const memberSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    totalAmount: { type: Number, default: 0 },
    transactions: { type: [transactionSchema], default: [] },
}, { timestamps: true });

// Compound index để truy vấn nhanh theo guildId + userId
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Member', memberSchema);
