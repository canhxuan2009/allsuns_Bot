const logger = require('./logger');

/**
 * Lấy bảng mapping VIP → Role ID từ biến môi trường (.env)
 * @param {string} [guildId] - ID server (bỏ qua vì dùng chung cấu hình ở .env)
 * @returns {Object} roleMapping { "1": "roleId", "2": "roleId", ... }
 */
function getRoleMapping(guildId) {
    try {
        const mappingStr = process.env.VIP_ROLE_MAPPING;
        if (!mappingStr) {
            return {};
        }
        return JSON.parse(mappingStr);
    } catch (e) {
        logger.error(`[Settings] Lỗi parse VIP_ROLE_MAPPING từ .env: ${e.message}`);
        return {};
    }
}

/**
 * Lấy danh sách Bot Admin từ biến môi trường (.env)
 * @param {string} [guildId] - ID server (bỏ qua vì dùng chung cấu hình ở .env)
 * @returns {string[]} Mảng chứa các user ID là Bot Admin
 */
function getBotAdmins(guildId) {
    const adminsStr = process.env.BOT_ADMINS;
    if (!adminsStr) {
        return [];
    }
    return adminsStr.split(',').map(id => id.trim()).filter(Boolean);
}

/**
 * Kiểm tra một người dùng có phải Bot Admin không
 * @param {string} guildId - ID server
 * @param {string} userId - ID người dùng
 * @returns {boolean}
 */
function isBotAdmin(guildId, userId) {
    const admins = getBotAdmins(guildId);
    return admins.includes(userId);
}

// ─── Các hàm Stub (Tương thích ngược) ──────────────────────────────────
// Đảm bảo không bị crash nếu có file nào khác vô tình import nhưng không sử dụng.
function loadSettings() { return {}; }
function saveSettings() {}
function setRoleMapping() {}
function removeRoleMapping() {}
function addBotAdmin() { return false; }
function removeBotAdmin() { return false; }

module.exports = {
    loadSettings,
    saveSettings,
    getRoleMapping,
    setRoleMapping,
    removeRoleMapping,
    getBotAdmins,
    addBotAdmin,
    removeBotAdmin,
    isBotAdmin,
};
