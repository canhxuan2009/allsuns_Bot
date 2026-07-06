const Member = require('../models/member');

/**
 * Lấy dữ liệu của một thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 * @returns {Promise<Object>} Dữ liệu thành viên { totalAmount, transactions }
 */
async function getMember(guildId, userId) {
    const doc = await Member.findOne({ guildId, userId }).lean();
    if (!doc) {
        return { totalAmount: 0, transactions: [] };
    }
    return { totalAmount: doc.totalAmount, transactions: doc.transactions };
}

/**
 * Cập nhật dữ liệu thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 * @param {Object} memberData - Dữ liệu mới { totalAmount, transactions }
 */
async function updateMember(guildId, userId, memberData) {
    await Member.findOneAndUpdate(
        { guildId, userId },
        {
            totalAmount: memberData.totalAmount,
            transactions: memberData.transactions,
        },
        { upsert: true, new: true },
    );
}

/**
 * Xóa dữ liệu thành viên
 * @param {string} guildId - ID server
 * @param {string} userId - ID thành viên
 */
async function deleteMember(guildId, userId) {
    await Member.deleteOne({ guildId, userId });
}

/**
 * Lấy tất cả thành viên của một server
 * @param {string} guildId - ID server
 * @returns {Promise<Object>} Object chứa tất cả thành viên { userId: memberData }
 */
async function getAllMembers(guildId) {
    const docs = await Member.find({ guildId }).lean();
    const result = {};
    for (const doc of docs) {
        result[doc.userId] = {
            totalAmount: doc.totalAmount,
            transactions: doc.transactions,
        };
    }
    return result;
}

module.exports = {
    getMember,
    updateMember,
    deleteMember,
    getAllMembers,
};
