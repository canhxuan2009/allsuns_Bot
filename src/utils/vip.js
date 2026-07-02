/**
 * Bảng màu cho từng VIP level
 */
const VIP_COLORS = {
    0: 0x95a5a6,  // Xám - Không VIP
    1: 0x2ecc71,  // Xanh lá
    2: 0x3498db,  // Xanh dương
    3: 0x9b59b6,  // Tím
    4: 0xe67e22,  // Cam
    5: 0xe74c3c,  // Đỏ
    6: 0xf39c12,  // Vàng đậm
    7: 0x1abc9c,  // Xanh ngọc
    8: 0xe91e63,  // Hồng đậm
    9: 0xff6b35,  // Cam đỏ
    10: 0xffd700, // Vàng kim - VIP cao nhất
};

/**
 * Emoji cho từng VIP level
 */
const VIP_EMOJIS = {
    0: '👤',
    1: '⭐',
    2: '⭐⭐',
    3: '🌟',
    4: '🌟🌟',
    5: '💎',
    6: '💎💎',
    7: '👑',
    8: '👑👑',
    9: '🏆',
    10: '🏆👑',
};

/**
 * Tính VIP level từ tổng tiền giao dịch
 * @param {number} totalAmount - Tổng số tiền
 * @returns {number} VIP level (0-10)
 */
function getVipLevel(totalAmount) {
    return Math.min(Math.floor(totalAmount / 100000), 10);
}

/**
 * Lấy tên hiển thị VIP
 * @param {number} level - VIP level
 * @returns {string} Tên VIP (vd: "⭐ VIP 1")
 */
function getVipName(level) {
    if (level === 0) return '👤 Thành viên';
    return `${VIP_EMOJIS[level]} VIP ${level}`;
}

/**
 * Lấy màu embed cho VIP level
 * @param {number} level - VIP level
 * @returns {number} Mã màu hex
 */
function getVipColor(level) {
    return VIP_COLORS[level] || VIP_COLORS[0];
}

/**
 * Tạo thanh tiến trình đến VIP tiếp theo
 * @param {number} totalAmount - Tổng số tiền
 * @returns {string} Thanh tiến trình dạng text
 */
function getVipProgressBar(totalAmount) {
    const currentLevel = getVipLevel(totalAmount);

    if (currentLevel >= 10) {
        return '▓▓▓▓▓▓▓▓▓▓ MAX VIP! 🎉';
    }

    const nextLevelAmount = (currentLevel + 1) * 100000;
    const currentLevelAmount = currentLevel * 100000;
    const progress = totalAmount - currentLevelAmount;
    const needed = nextLevelAmount - currentLevelAmount; // luôn = 100000
    const percentage = Math.floor((progress / needed) * 100);
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;

    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    const remaining = nextLevelAmount - totalAmount;

    return `${bar} ${percentage}% (còn ${formatMoney(remaining)} → VIP ${currentLevel + 1})`;
}

/**
 * Format số tiền với dấu chấm phân cách và đơn vị đ
 * @param {number} amount - Số tiền
 * @returns {string} Chuỗi đã format (vd: "500.000đ")
 */
function formatMoney(amount) {
    return amount.toLocaleString('vi-VN') + 'đ';
}

module.exports = {
    getVipLevel,
    getVipName,
    getVipColor,
    getVipProgressBar,
    formatMoney,
    VIP_COLORS,
    VIP_EMOJIS,
};
