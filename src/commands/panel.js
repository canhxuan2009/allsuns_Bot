const { SlashCommandBuilder } = require('discord.js');
const EscrowTicket = require('../models/escrowTicket');
const { buildDealEmbed, buildActionButtons } = require('../utils/escrowInteractions');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Kéo bảng điều khiển giao dịch xuống dưới cùng của kênh chat'),

    async execute(interaction) {
        // 1. Tìm thông tin deal trong DB theo kênh hiện tại
        const ticket = await EscrowTicket.findOne({ channelId: interaction.channelId });
        if (!ticket) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ dùng được trong kênh Ticket Deal đang hoạt động.',
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 2. Tìm tin nhắn bảng điều khiển cũ của bot
            const messages = await interaction.channel.messages.fetch({ limit: 50 });
            const botMsg = messages.find(m =>
                m.author.id === interaction.client.user.id && 
                m.embeds.length > 0 &&
                m.embeds[0]?.title?.includes('Giao Dịch Trung Gian')
            );

            // 3. Xoá bảng điều khiển cũ nếu tìm thấy
            if (botMsg) {
                await botMsg.delete().catch(err => {
                    logger.error(`[Escrow] Không thể xoá bảng điều khiển cũ trong kênh ${interaction.channel.name}: ${err.message}`);
                });
            }

            // 4. Tạo bảng điều khiển mới tinh
            const embed = buildDealEmbed(ticket, interaction.guild);
            const components = buildActionButtons(ticket);

            // 5. Gửi bảng điều khiển mới xuống cuối kênh chat
            await interaction.channel.send({
                embeds: [embed],
                components,
            });

            // 6. Phản hồi ẩn cho người gõ lệnh
            await interaction.editReply({
                content: '✅ Đã đẩy bảng điều khiển xuống dưới cùng thành công!',
            });

            logger.info(`[Escrow] Deal #${ticket.dealId}: Người dùng ${interaction.user.tag} đã dùng lệnh /panel để kéo bảng điều khiển.`);

        } catch (err) {
            logger.error(`[Escrow] Lỗi khi thực hiện lệnh /panel: ${err.message}`);
            await interaction.editReply({
                content: `❌ Gặp lỗi khi di chuyển bảng điều khiển: ${err.message}`,
            });
        }
    },
};
