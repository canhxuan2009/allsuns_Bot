const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isBotAdmin } = require('../utils/settings');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket_panel')
        .setDescription('Tạo panel Ticket Hỗ Trợ & Bảo Hành (Chỉ dành cho Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Chỉ admin mới có quyền tạo panel
        if (!isBotAdmin(interaction.guildId, interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🎫 Trung Tâm Hỗ Trợ & Bảo Hành')
            .setDescription('Chào mừng bạn đến với hệ thống hỗ trợ của chúng tôi.\nVui lòng nhấn vào nút tương ứng bên dưới để tạo Ticket mới.')
            .addFields(
                { name: '🛠️ Hỗ Trợ', value: 'Giải đáp thắc mắc, báo lỗi, hoặc các vấn đề khác.' },
                { name: '🛡️ Bảo Hành', value: 'Yêu cầu bảo hành sản phẩm đã mua (Cần cung cấp tên sản phẩm).' }
            )
            .setFooter({ text: 'Chúng tôi sẽ phản hồi trong thời gian sớm nhất!' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_create_support')
                    .setLabel('Hỗ Trợ')
                    .setEmoji('🛠️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_create_warranty')
                    .setLabel('Bảo Hành')
                    .setEmoji('🛡️')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        return interaction.reply({
            content: '✅ Đã tạo Panel Ticket thành công!',
            ephemeral: true,
        });
    },
};
