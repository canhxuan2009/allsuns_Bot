const mongoose = require('mongoose');

const escrowTicketSchema = new mongoose.Schema({
    guildId:      { type: String, required: true },
    channelId:    { type: String, default: null },    // ID kênh ticket đã tạo
    dealId:       { type: String, required: true },    // ID ngắn dạng "E-XXXX"
    buyerId:      { type: String, required: true },
    sellerId:     { type: String, default: null },
    midmanId:     { type: String, default: null },     // Midman đang xử lý case này
    currency:     { type: String, enum: ['VND', 'DONUT'], default: 'VND' },
    amount:       { type: Number, default: 0 },
    fee:          { type: Number, default: 0 },        // Phí tính toán theo nấc
    feePayer:     { type: String, enum: ['BUYER', 'SELLER'], default: 'BUYER' },
    totalToPay:   { type: Number, default: 0 },        // Tổng Buyer cần chuyển
    netToReceive: { type: Number, default: 0 },        // Seller thực nhận
    description:  { type: String, default: '' },
    status: {
        type: String,
        enum: [
            'SETUP',             // Người mua đang điền thông tin
            'WAITING_FUNDS',     // Chờ chuyển tiền cho Midman
            'WAITING_DELIVERY',  // Midman đã cầm tiền, chờ giao hàng
            'BUYER_CHECK',       // Người mua kiểm tra hàng
            'HOLDING',           // Tiền bị giữ (bảo hành)
            'READY_PAYOUT',      // Midman chuyển tiền cho Seller
            'COMPLETED',         // Hoàn tất
            'CANCELLED',         // Đã huỷ
        ],
        default: 'SETUP',
    },
}, { timestamps: true });

// Index theo guildId + dealId để truy vấn nhanh
escrowTicketSchema.index({ guildId: 1, dealId: 1 }, { unique: true });
// Index theo channelId để tra cứu ticket từ kênh
escrowTicketSchema.index({ channelId: 1 });

module.exports = mongoose.model('EscrowTicket', escrowTicketSchema);
