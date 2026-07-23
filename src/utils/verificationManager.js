const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const filePath = path.join(process.cwd(), 'verifications.json');

/**
 * Đọc danh sách xác minh từ file JSON
 * @returns {Array} Danh sách các phiên xác minh đang chờ
 */
function loadVerifications() {
    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        logger.error(`[VerificationManager] Lỗi khi đọc file verifications.json: ${err.message}`);
        return [];
    }
}

/**
 * Ghi danh sách xác minh vào file JSON
 * @param {Array} data Danh sách cần lưu
 */
function saveVerifications(data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        logger.error(`[VerificationManager] Lỗi khi ghi file verifications.json: ${err.message}`);
    }
}

/**
 * Lưu một tin nhắn xác minh mới vào JSON
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 * @param {string} userId
 * @param {string} code - Mã CAPTCHA đúng của tin nhắn này
 */
function addVerification(guildId, channelId, messageId, userId, code) {
    const list = loadVerifications();
    
    // Tránh trùng lặp
    if (list.some(item => item.messageId === messageId)) return;

    list.push({
        guildId,
        channelId,
        messageId,
        userId,
        code,
        createdAt: Date.now()
    });
    saveVerifications(list);
    logger.info(`[VerificationManager] Đã lưu tin nhắn xác minh của user ${userId} vào JSON (Message ID: ${messageId})`);
}

/**
 * Lấy thông tin xác minh theo messageId
 * @param {string} messageId
 * @returns {{ guildId, channelId, messageId, userId, code, createdAt } | null}
 */
function getVerification(messageId) {
    const list = loadVerifications();
    return list.find(item => item.messageId === messageId) ?? null;
}

/**
 * Xoá tin nhắn xác minh khỏi JSON khi đã xác minh thành công
 * @param {string} messageId
 */
function removeVerification(messageId) {
    const list = loadVerifications();
    const filtered = list.filter(item => item.messageId !== messageId);
    if (list.length !== filtered.length) {
        saveVerifications(filtered);
        logger.info(`[VerificationManager] Đã xoá tin nhắn xác minh ${messageId} khỏi JSON.`);
    }
}

/**
 * Kiểm tra và dọn dẹp các tin nhắn xác minh quá hạn
 * @param {import('discord.js').Client} client
 */
async function checkAndCleanup(client) {
    const list = loadVerifications();
    if (list.length === 0) return;

    const timeoutHours = parseFloat(process.env.VERIFICATION_TIMEOUT_HOURS) || 48;
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    const now = Date.now();
    
    const expired = [];
    const remaining = [];

    for (const item of list) {
        if (now - item.createdAt >= timeoutMs) {
            expired.push(item);
        } else {
            remaining.push(item);
        }
    }

    if (expired.length === 0) return;

    logger.info(`[VerificationManager] Phát hiện ${expired.length} tin nhắn xác minh quá hạn ${timeoutHours} giờ. Tiến hành dọn dẹp...`);

    for (const item of expired) {
        try {
            const guild = await client.guilds.fetch(item.guildId).catch(() => null);
            if (guild) {
                const channel = await guild.channels.fetch(item.channelId).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(item.messageId).catch(() => null);
                    if (message) {
                        await message.delete().catch(() => null);
                        logger.info(`[VerificationManager] 🧹 Đã xoá tin nhắn xác minh quá hạn ${item.messageId} của user ${item.userId}`);
                    }
                }
            }
        } catch (err) {
            logger.error(`[VerificationManager] Lỗi khi dọn dẹp tin nhắn ${item.messageId}: ${err.message}`);
        }
    }

    // Cập nhật lại file JSON với các tin nhắn còn lại
    saveVerifications(remaining);
}

/**
 * Khởi tạo tiến trình tự động dọn dẹp
 * @param {import('discord.js').Client} client
 */
function initVerificationCleanup(client) {
    // Chạy dọn dẹp ngay lập tức khi khởi động
    checkAndCleanup(client).catch(err => {
        logger.error(`[VerificationManager] Lỗi khi chạy checkAndCleanup lần đầu: ${err.message}`);
    });

    // Thiết lập quét định kỳ mỗi 10 phút
    setInterval(() => {
        checkAndCleanup(client).catch(err => {
            logger.error(`[VerificationManager] Lỗi khi chạy checkAndCleanup định kỳ: ${err.message}`);
        });
    }, 10 * 60 * 1000);
}

module.exports = {
    addVerification,
    removeVerification,
    getVerification,
    initVerificationCleanup,
    checkAndCleanup // Export để có thể gọi thủ công hoặc test nếu cần
};
