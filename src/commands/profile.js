const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMember } = require('../utils/database');
const { getVipLevel, getVipName, getVipColor, getVipProgressBar, formatMoney } = require('../utils/vip');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Xem thông tin VIP của thành viên')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Thành viên muốn xem (bỏ trống = xem bản thân)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.reply({
                content: '❌ Không thể xem thông tin của bot!',
                ephemeral: true,
            });
        }

        const guildId = interaction.guild.id;
        const memberData = getMember(guildId, targetUser.id);
        const vipLevel = getVipLevel(memberData.totalAmount);

        // Lấy 5 giao dịch gần nhất
        const recentTransactions = memberData.transactions
            .slice(-5)
            .reverse()
            .map((t, i) => {
                const date = new Date(t.date).toLocaleDateString('vi-VN');
                const sign = t.amount >= 0 ? '+' : '';
                return `\`${i + 1}.\` ${sign}${formatMoney(t.amount)} — ${t.note} _(${date})_`;
            })
            .join('\n') || '_Chưa có giao dịch nào_';

        const embed = new EmbedBuilder()
            .setColor(getVipColor(vipLevel))
            .setTitle(`${getVipName(vipLevel)}`)
            .setAuthor({
                name: targetUser.displayName,
                iconURL: targetUser.displayAvatarURL({ size: 64 }),
            })
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '💰 Tổng giao dịch', value: formatMoney(memberData.totalAmount), inline: true },
                { name: '🏅 VIP Level', value: vipLevel > 0 ? `VIP ${vipLevel}` : 'Chưa có VIP', inline: true },
                { name: '📊 Số giao dịch', value: `${memberData.transactions.length} lần`, inline: true },
                { name: '📈 Tiến trình', value: getVipProgressBar(memberData.totalAmount) },
                { name: '📋 Giao dịch gần đây', value: recentTransactions },
            )
            .setFooter({ text: `ID: ${targetUser.id}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
