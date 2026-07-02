const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getMember, deleteMember } = require('../utils/database');
const { getVipLevel, getVipName, formatMoney } = require('../utils/vip');
const { removeAllVipRoles } = require('../utils/roles');
const { hasPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Reset toàn bộ dữ liệu giao dịch của thành viên')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Thành viên cần reset')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('Xác nhận reset (true = đồng ý)')
                .setRequired(true)),

    async execute(interaction) {
        // Kiểm tra quyền: Administrator hoặc Bot Admin
        if (!hasPermission(interaction, PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!\n💡 Cần quyền **Quản trị viên** hoặc được cấp **Bot Admin**.',
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser('user');
        const confirm = interaction.options.getBoolean('confirm');

        if (targetUser.bot) {
            return interaction.reply({
                content: '❌ Không thể reset dữ liệu bot!',
                ephemeral: true,
            });
        }

        if (!confirm) {
            return interaction.reply({
                content: '❌ Bạn đã hủy thao tác reset.',
                ephemeral: true,
            });
        }

        const guildId = interaction.guild.id;
        const memberData = getMember(guildId, targetUser.id);

        if (memberData.totalAmount === 0 && memberData.transactions.length === 0) {
            return interaction.reply({
                content: `❌ ${targetUser} không có dữ liệu giao dịch nào!`,
                ephemeral: true,
            });
        }

        const oldLevel = getVipLevel(memberData.totalAmount);
        const oldAmount = memberData.totalAmount;
        const oldTransactions = memberData.transactions.length;

        // Xóa role VIP
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        await removeAllVipRoles(interaction.guild, targetMember);

        // Xóa dữ liệu
        deleteMember(guildId, targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🗑️ Reset Dữ Liệu')
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: '👤 Thành viên', value: `${targetUser}`, inline: true },
                { name: '💰 Tiền đã xóa', value: formatMoney(oldAmount), inline: true },
                { name: '🏅 VIP đã xóa', value: getVipName(oldLevel), inline: true },
                { name: '📊 Giao dịch đã xóa', value: `${oldTransactions} lần`, inline: true },
                { name: '🎭 Role VIP', value: 'Đã gỡ tất cả', inline: true },
            )
            .setFooter({ text: `Thực hiện bởi ${interaction.user.displayName}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
