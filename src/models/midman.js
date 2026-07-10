const mongoose = require('mongoose');

const midmanSchema = new mongoose.Schema({
    guildId:       { type: String, required: true },
    userId:        { type: String, required: true },        // ID Discord của Midman
    displayName:   { type: String, required: true },        // Tên hiển thị trên hoá đơn
    bankName:      { type: String, required: true },        // Tên ngân hàng (VD: MB, VCB)
    accountHolder: { type: String, required: true },        // Tên chủ tài khoản
    accountNumber: { type: String, required: true },        // Số tài khoản
    qrUrl:         { type: String, default: null },         // URL ảnh QR tĩnh (tuỳ chọn)
}, { timestamps: true });

// Compound index để truy vấn theo guildId + userId (1 Midman chỉ có 1 config/guild)
midmanSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Midman', midmanSchema);
