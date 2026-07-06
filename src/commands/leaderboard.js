const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllMembers } = require('../utils/database');
const { getVipLevel, getVipName, formatMoney, VIP_EMOJIS } = require('../utils/vip');

/**
 * Medal emoji cho top 3
 */
const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Bảng xếp hạng giao dịch top 10'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const allMembers = await getAllMembers(guildId);

        // Sắp xếp theo tổng tiền giảm dần
        const sorted = Object.entries(allMembers)
            .filter(([, data]) => data.totalAmount > 0)
            .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
            .slice(0, 10);

        if (sorted.length === 0) {
            return interaction.reply({
                content: '📭 Chưa có thành viên nào có giao dịch!',
                ephemeral: true,
            });
        }

        // Tạo danh sách xếp hạng
        const leaderboardLines = await Promise.all(
            sorted.map(async ([userId, data], index) => {
                const vipLevel = getVipLevel(data.totalAmount);
                const medal = MEDALS[index] || `\`#${index + 1}\``;
                const vipEmoji = VIP_EMOJIS[vipLevel] || '';

                let username;
                try {
                    const user = await interaction.client.users.fetch(userId);
                    username = user.displayName;
                } catch {
                    username = `User ${userId.slice(-4)}`;
                }

                return `${medal} **${username}** ${vipEmoji}\n` +
                       `┗ ${formatMoney(data.totalAmount)} • ${getVipName(vipLevel)}`;
            })
        );

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle('🏆 Bảng Xếp Hạng Giao Dịch')
            .setDescription(leaderboardLines.join('\n\n'))
            .setFooter({
                text: `Tổng: ${Object.keys(allMembers).length} thành viên • ${interaction.guild.name}`,
                iconURL: interaction.guild.iconURL({ size: 64 }),
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
