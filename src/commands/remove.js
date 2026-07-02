const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getMember, updateMember } = require('../utils/database');
const { getVipLevel, getVipName, getVipColor, getVipProgressBar, formatMoney } = require('../utils/vip');
const { updateMemberRole } = require('../utils/roles');
const { hasPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Trừ giao dịch của thành viên')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Thành viên cần trừ giao dịch')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Số tiền cần trừ (đ)')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Lý do trừ tiền')
                .setRequired(false)),

    async execute(interaction) {
        // Kiểm tra quyền: ManageGuild hoặc Bot Admin
        if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!\n💡 Cần quyền **Quản lý máy chủ** hoặc được cấp **Bot Admin**.',
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const note = interaction.options.getString('note') || 'Không có ghi chú';

        if (targetUser.bot) {
            return interaction.reply({
                content: '❌ Không thể trừ giao dịch cho bot!',
                ephemeral: true,
            });
        }

        const guildId = interaction.guild.id;
        const memberData = getMember(guildId, targetUser.id);

        if (memberData.totalAmount === 0) {
            return interaction.reply({
                content: `❌ ${targetUser} chưa có giao dịch nào!`,
                ephemeral: true,
            });
        }

        const oldLevel = getVipLevel(memberData.totalAmount);

        // Trừ tiền (không cho âm)
        const actualRemoved = Math.min(amount, memberData.totalAmount);
        memberData.totalAmount -= actualRemoved;
        memberData.transactions.push({
            amount: -actualRemoved,
            note: note,
            date: new Date().toISOString(),
            addedBy: interaction.user.id,
        });

        updateMember(guildId, targetUser.id, memberData);

        const newLevel = getVipLevel(memberData.totalAmount);

        // Cập nhật role nếu VIP thay đổi
        let roleInfo = '';
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        const roleResult = await updateMemberRole(interaction.guild, targetMember, oldLevel, newLevel);

        if (roleResult.error) {
            roleInfo = `\n⚠️ Không thể cập nhật role: ${roleResult.error}`;
        } else if (roleResult.changed && (roleResult.oldRole || roleResult.newRole)) {
            const oldRoleName = roleResult.oldRole ? roleResult.oldRole.name : 'Không có';
            const newRoleName = roleResult.newRole ? roleResult.newRole.name : 'Không có';
            roleInfo = `\n🎭 Role: ~~${oldRoleName}~~ → **${newRoleName}**`;
        }

        const embed = new EmbedBuilder()
            .setColor(getVipColor(newLevel))
            .setTitle('💸 Trừ Giao Dịch')
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: '👤 Thành viên', value: `${targetUser}`, inline: true },
                { name: '💵 Số tiền trừ', value: `-${formatMoney(actualRemoved)}`, inline: true },
                { name: '📝 Lý do', value: note, inline: true },
                { name: '💰 Tổng còn lại', value: formatMoney(memberData.totalAmount), inline: true },
                { name: '🏅 VIP Level', value: getVipName(newLevel), inline: true },
                { name: '📊 Tiến trình', value: getVipProgressBar(memberData.totalAmount) },
            )
            .setFooter({ text: `Thực hiện bởi ${interaction.user.displayName}` })
            .setTimestamp();

        if (newLevel < oldLevel) {
            embed.addFields({
                name: '⬇️ Giảm VIP',
                value: `${targetUser} đã giảm từ **${getVipName(oldLevel)}** xuống **${getVipName(newLevel)}** ${roleInfo}`,
            });
        }

        if (actualRemoved < amount) {
            embed.addFields({
                name: '⚠️ Lưu ý',
                value: `Chỉ trừ được ${formatMoney(actualRemoved)} (yêu cầu ${formatMoney(amount)})`,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
