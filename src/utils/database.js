const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');

/**
 * Đảm bảo thư mục data tồn tại
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Đọc dữ liệu thành viên từ file JSON
 * @returns {Object} Dữ liệu thành viên
 */
function loadData() {
    ensureDataDir();
    if (!fs.existsSync(MEMBERS_FILE)) {
        fs.writeFileSync(MEMBERS_FILE, JSON.stringify({}, null, 2), 'utf-8');
        return {};
    }
    try {
        const raw = fs.readFileSync(MEMBERS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/**
 * Ghi dữ liệu thành viên vào file JSON
 * @param {Object} data - Dữ liệu cần ghi
 */
function saveData(data) {
    ensureDataDir();
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Lấy dữ liệu của một thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 * @returns {Object} Dữ liệu thành viên { totalAmount, transactions }
 */
function getMember(guildId, userId) {
    const data = loadData();
    if (!data[guildId] || !data[guildId][userId]) {
        return { totalAmount: 0, transactions: [] };
    }
    return data[guildId][userId];
}

/**
 * Cập nhật dữ liệu thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 * @param {Object} memberData - Dữ liệu mới
 */
function updateMember(guildId, userId, memberData) {
    const data = loadData();
    if (!data[guildId]) {
        data[guildId] = {};
    }
    data[guildId][userId] = memberData;
    saveData(data);
}

/**
 * Xóa dữ liệu thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 */
function deleteMember(guildId, userId) {
    const data = loadData();
    if (data[guildId] && data[guildId][userId]) {
        delete data[guildId][userId];
        saveData(data);
    }
}

/**
 * Lấy tất cả thành viên của một server
 * @param {string} guildId - ID server
 * @returns {Object} Object chứa tất cả thành viên { userId: memberData }
 */
function getAllMembers(guildId) {
    const data = loadData();
    return data[guildId] || {};
}

module.exports = {
    loadData,
    saveData,
    getMember,
    updateMember,
    deleteMember,
    getAllMembers,
};
