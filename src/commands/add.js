const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getMember, updateMember } = require('../utils/database');
const { getVipLevel, getVipName, getVipColor, getVipProgressBar, formatMoney } = require('../utils/vip');
const { updateMemberRole } = require('../utils/roles');
const { hasPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Thêm giao dịch cho thành viên')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Thành viên cần thêm giao dịch')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Số tiền giao dịch (đ)')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Ghi chú giao dịch')
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

        // Không cho phép thêm giao dịch cho bot
        if (targetUser.bot) {
            return interaction.reply({
                content: '❌ Không thể thêm giao dịch cho bot!',
                ephemeral: true,
            });
        }

        const guildId = interaction.guild.id;
        const memberData = getMember(guildId, targetUser.id);
        const oldLevel = getVipLevel(memberData.totalAmount);

        // Thêm giao dịch
        memberData.totalAmount += amount;
        memberData.transactions.push({
            amount: amount,
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
        } else if (roleResult.newRole) {
            roleInfo = `\n🎭 Role: ${roleResult.oldRole ? `~~${roleResult.oldRole.name}~~ → ` : ''}**${roleResult.newRole.name}**`;
        }

        // Tạo embed
        const embed = new EmbedBuilder()
            .setColor(getVipColor(newLevel))
            .setTitle('💰 Giao Dịch Thành Công')
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: '👤 Thành viên', value: `${targetUser}`, inline: true },
                { name: '💵 Số tiền', value: `+${formatMoney(amount)}`, inline: true },
                { name: '📝 Ghi chú', value: note, inline: true },
                { name: '💰 Tổng giao dịch', value: formatMoney(memberData.totalAmount), inline: true },
                { name: '🏅 VIP Level', value: getVipName(newLevel), inline: true },
                { name: '📊 Tiến trình', value: getVipProgressBar(memberData.totalAmount) },
            )
            .setFooter({ text: `Thực hiện bởi ${interaction.user.displayName}` })
            .setTimestamp();

        // Thêm thông báo lên VIP
        if (newLevel > oldLevel) {
            embed.addFields({
                name: '🎉 CHÚC MỪNG LÊN VIP!',
                value: `${targetUser} đã lên **${getVipName(newLevel)}**! ${roleInfo}`,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
