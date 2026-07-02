const { isBotAdmin } = require('./settings');

/**
 * Kiểm tra người dùng có quyền sử dụng lệnh không
 * Cho phép nếu: Chủ server, có quyền Discord yêu cầu, hoặc là Bot Admin
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {bigint} requiredPermission - Discord permission flag cần thiết
 * @returns {boolean}
 */
function hasPermission(interaction, requiredPermission) {
    // Chủ server luôn có quyền
    if (interaction.guild.ownerId === interaction.user.id) {
        return true;
    }

    // Kiểm tra quyền Discord gốc
    if (interaction.member.permissions.has(requiredPermission)) {
        return true;
    }

    // Kiểm tra Bot Admin
    if (isBotAdmin(interaction.guild.id, interaction.user.id)) {
        return true;
    }

    return false;
}

module.exports = { hasPermission };
