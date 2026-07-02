const { getRoleMapping } = require('./settings');

/**
 * Cập nhật role VIP cho thành viên khi VIP level thay đổi
 * @param {import('discord.js').Guild} guild - Discord Guild object
 * @param {import('discord.js').GuildMember} member - Discord GuildMember object
 * @param {number} oldLevel - VIP level cũ
 * @param {number} newLevel - VIP level mới
 * @returns {Object} Kết quả { changed, oldRole, newRole, error }
 */
async function updateMemberRole(guild, member, oldLevel, newLevel) {
    const result = { changed: false, oldRole: null, newRole: null, error: null };

    if (oldLevel === newLevel) {
        return result;
    }

    const roleMapping = getRoleMapping(guild.id);

    // Không có role mapping nào được cấu hình
    if (Object.keys(roleMapping).length === 0) {
        return result;
    }

    try {
        // Xóa role VIP cũ (nếu có mapping)
        if (oldLevel > 0 && roleMapping[String(oldLevel)]) {
            const oldRoleId = roleMapping[String(oldLevel)];
            const oldRole = guild.roles.cache.get(oldRoleId);
            if (oldRole && member.roles.cache.has(oldRoleId)) {
                await member.roles.remove(oldRole, `VIP ${oldLevel} → VIP ${newLevel}`);
                result.oldRole = oldRole;
            }
        }

        // Gán role VIP mới (nếu có mapping)
        if (newLevel > 0 && roleMapping[String(newLevel)]) {
            const newRoleId = roleMapping[String(newLevel)];
            const newRole = guild.roles.cache.get(newRoleId);
            if (newRole && !member.roles.cache.has(newRoleId)) {
                await member.roles.add(newRole, `Đạt VIP ${newLevel}`);
                result.newRole = newRole;
            }
        }

        result.changed = true;
    } catch (error) {
        result.error = error.message;
        console.error(`[Roles] Lỗi cập nhật role cho ${member.user.tag}:`, error.message);
    }

    return result;
}

/**
 * Xóa tất cả role VIP của thành viên
 * @param {import('discord.js').Guild} guild - Discord Guild object
 * @param {import('discord.js').GuildMember} member - Discord GuildMember object
 * @returns {boolean} true nếu thành công
 */
async function removeAllVipRoles(guild, member) {
    const roleMapping = getRoleMapping(guild.id);

    try {
        for (const [, roleId] of Object.entries(roleMapping)) {
            if (member.roles.cache.has(roleId)) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.remove(role, 'Reset VIP');
                }
            }
        }
        return true;
    } catch (error) {
        console.error(`[Roles] Lỗi xóa role VIP cho ${member.user.tag}:`, error.message);
        return false;
    }
}

module.exports = {
    updateMemberRole,
    removeAllVipRoles,
};
