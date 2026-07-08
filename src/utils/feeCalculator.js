const logger = require('./logger');

/**
 * Cấu hình nấc phí cho từng loại tiền tệ.
 * Mỗi nấc chứa: maxAmount (giới hạn trên), type ('fixed' hoặc 'percent'),
 * value (giá trị phí), cap (giới hạn phí tối đa, chỉ dùng cho type='percent').
 *
 * Hệ thống sẽ duyệt từ nấc đầu tiên. Nấc cuối cùng (maxAmount = Infinity) là mặc định.
 */
const FEE_TIERS = {
    VND: [
        { maxAmount: 100_000,   type: 'fixed',   value: 5_000 },
        { maxAmount: 500_000,   type: 'percent', value: 0.05 },
        { maxAmount: Infinity,  type: 'percent', value: 0.03, cap: 50_000 },
    ],
    DONUT: [
        { maxAmount: 1_000_000, type: 'fixed',   value: 50_000 },
        { maxAmount: Infinity,  type: 'percent', value: 0.02 },
    ],
};

/**
 * Tính phí giao dịch trung gian dựa trên loại tiền và số tiền.
 * @param {string} currency - "VND" hoặc "DONUT"
 * @param {number} amount - Số tiền giao dịch
 * @returns {number} Số tiền phí
 */
function calculateEscrowFee(currency, amount) {
    const tiers = FEE_TIERS[currency];
    if (!tiers) {
        logger.warn(`[FeeCalc] Không tìm thấy cấu hình phí cho loại tiền: ${currency}`);
        return 0;
    }

    for (const tier of tiers) {
        if (amount < tier.maxAmount || tier.maxAmount === Infinity) {
            if (tier.type === 'fixed') {
                return tier.value;
            }
            // type === 'percent'
            const fee = Math.round(amount * tier.value);
            return tier.cap ? Math.min(fee, tier.cap) : fee;
        }
    }

    return 0;
}

/**
 * Tính toán đầy đủ phí, tổng cần chuyển, và thực nhận dựa trên bên chịu phí.
 * @param {string} currency - "VND" hoặc "DONUT"
 * @param {number} amount - Số tiền giao dịch gốc
 * @param {string} feePayer - "BUYER" hoặc "SELLER"
 * @returns {{ fee: number, totalToPay: number, netToReceive: number }}
 */
function calculateDealAmounts(currency, amount, feePayer) {
    const fee = calculateEscrowFee(currency, amount);

    if (feePayer === 'BUYER') {
        return {
            fee,
            totalToPay:   amount + fee,  // Buyer trả thêm phí
            netToReceive: amount,         // Seller nhận đủ 100%
        };
    }

    // feePayer === 'SELLER'
    return {
        fee,
        totalToPay:   amount,           // Buyer chỉ chuyển số gốc
        netToReceive: amount - fee,     // Seller bị trừ phí
    };
}

/**
 * Format số tiền theo loại tiền tệ.
 * @param {number} amount
 * @param {string} currency - "VND" hoặc "DONUT"
 * @returns {string}
 */
function formatEscrowMoney(amount, currency) {
    const formatted = amount.toLocaleString('vi-VN');
    return currency === 'VND' ? `${formatted} VND` : `${formatted} Donut`;
}

module.exports = {
    calculateEscrowFee,
    calculateDealAmounts,
    formatEscrowMoney,
    FEE_TIERS,
};
