const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TRACKER_FILE = path.join(DATA_DIR, 'tracker.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function loadData() {
    ensureDataDir();
    if (!fs.existsSync(TRACKER_FILE)) {
        fs.writeFileSync(TRACKER_FILE, JSON.stringify({}, null, 2), 'utf-8');
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveData(data) {
    ensureDataDir();
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Đăng ký theo dõi một kênh
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} baseName - Tên gốc của kênh (không có số)
 */
function addTracked(guildId, channelId, baseName) {
    const data = loadData();
    if (!data[guildId]) data[guildId] = {};
    data[guildId][channelId] = { baseName };
    saveData(data);
}

/**
 * Hủy theo dõi một kênh
 * @returns {boolean} true nếu xóa thành công, false nếu không tìm thấy
 */
function removeTracked(guildId, channelId) {
    const data = loadData();
    if (data[guildId]?.[channelId]) {
        delete data[guildId][channelId];
        if (Object.keys(data[guildId]).length === 0) delete data[guildId];
        saveData(data);
        return true;
    }
    return false;
}

/**
 * Lấy thông tin theo dõi của một kênh
 * @returns {{ baseName: string } | null}
 */
function getTracked(guildId, channelId) {
    const data = loadData();
    return data[guildId]?.[channelId] ?? null;
}

/**
 * Lấy tất cả kênh đang theo dõi
 * @returns {Object} { guildId: { channelId: { baseName } } }
 */
function getAllTracked() {
    return loadData();
}

module.exports = { addTracked, removeTracked, getTracked, getAllTracked };
