const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EscrowTicket = require('../models/escrowTicket');
const ShopTicket = require('../models/shopTicket');
const SupportTicket = require('../models/ticket');
const { createAndSendTranscript } = require('../utils/transcript');
const { createAndSendTicketTranscript } = require('../utils/ticketTranscript');
const { isBotAdmin } = require('../utils/settings');
const logger = require('../utils/logger');

const SHOP_ADMIN_ID = '1053646107785302069';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dongticket')
        .setDescription('Cưỡng chế đóng ticket và tạo bản sao lưu (Transcript) cho cả 3 chức năng'),

    async execute(interaction) {
        const guild = interaction.guild;
        const channel = interaction.channel;
        const user = interaction.user;

        // Tạm thời defer để tránh timeout
        await interaction.deferReply();

        // 1. Kiểm tra xem channel này thuộc loại ticket nào
        let ticketType = null; // 'ESCROW', 'SHOP', 'SUPPORT_OR_WARRANTY'
        let ticketDoc = null;

        // Thử tìm trong EscrowTicket
        ticketDoc = await EscrowTicket.findOne({ channelId: channel.id });
        if (ticketDoc) {
            ticketType = 'ESCROW';
        } else {
            // Thử tìm trong ShopTicket
            ticketDoc = await ShopTicket.findOne({ channelId: channel.id });
            if (ticketDoc) {
                ticketType = 'SHOP';
            } else {
                // Thử tìm trong SupportTicket (ticket hỗ trợ/bảo hành)
                ticketDoc = await SupportTicket.findOne({ channelId: channel.id, status: 'OPEN' });
                if (ticketDoc) {
                    ticketType = 'SUPPORT_OR_WARRANTY';
                }
            }
        }

        if (!ticketType || !ticketDoc) {
            return interaction.editReply({
                content: '❌ Kênh này không phải là một kênh Ticket hợp lệ hoặc đã được đóng trước đó.',
            });
        }

        // 2. Kiểm tra quyền hạn đóng ticket
        const hasAdminPerm = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isGlobalAdmin = isBotAdmin(guild.id, user.id);
        
        let hasAccess = hasAdminPerm || isGlobalAdmin;

        if (!hasAccess) {
            if (ticketType === 'ESCROW') {
                const midmanRoleId = process.env.ESCROW_MIDMAN_ROLE_ID;
                if (midmanRoleId && interaction.member.roles.cache.has(midmanRoleId)) {
                    hasAccess = true;
                }
            } else if (ticketType === 'SHOP') {
                if (user.id === SHOP_ADMIN_ID) {
                    hasAccess = true;
                }
            } else if (ticketType === 'SUPPORT_OR_WARRANTY') {
                const pingRoleId = process.env.TICKET_PING_ROLE_ID;
                if (pingRoleId && interaction.member.roles.cache.has(pingRoleId)) {
                    hasAccess = true;
                }
                // Hỗ trợ cả người tạo ticket tự đóng
                if (user.id === ticketDoc.creatorId) {
                    hasAccess = true;
                }
            }
        }

        if (!hasAccess) {
            return interaction.editReply({
                content: '❌ Bạn không có quyền cưỡng chế đóng Ticket này.',
            });
        }

        // 3. Thực hiện đóng ticket
        await interaction.editReply('🔒 *Đang cưỡng chế đóng ticket và tạo bản lưu (Transcript)...*');

        let success = false;

        try {
            if (ticketType === 'ESCROW') {
                // Đổi trạng thái trong DB (nếu chưa hoàn tất hoặc huỷ thì chuyển thành huỷ để lưu đúng)
                if (ticketDoc.status !== 'COMPLETED' && ticketDoc.status !== 'CANCELLED') {
                    ticketDoc.status = 'CANCELLED';
                    await ticketDoc.save();
                }

                const logChannelId = process.env.ESCROW_SUMMARY_CHANNEL_ID || process.env.ESCROW_HTML_CHANNEL_ID || process.env.ESCROW_ATTACHMENT_CHANNEL_ID || process.env.ESCROW_LOG_CHANNEL_ID;
                success = await createAndSendTranscript(channel, ticketDoc, logChannelId);
            } 
            else if (ticketType === 'SHOP') {
                if (ticketDoc.status !== 'COMPLETED' && ticketDoc.status !== 'CANCELLED') {
                    ticketDoc.status = 'CANCELLED';
                    await ticketDoc.save();
                }

                const logChannelId = process.env.ESCROW_LOG_CHANNEL_ID;
                // map tạm để hàm cũ chạy
                ticketDoc.dealId = ticketDoc.ticketId;
                ticketDoc.amount = ticketDoc.price;
                ticketDoc.fee = 0;
                ticketDoc.feePayer = 'BUYER';
                ticketDoc.description = ticketDoc.productName;

                success = await createAndSendTranscript(channel, ticketDoc, logChannelId, true);
            } 
            else if (ticketType === 'SUPPORT_OR_WARRANTY') {
                ticketDoc.status = 'CLOSED';
                await ticketDoc.save();

                success = await createAndSendTicketTranscript(channel, ticketDoc);
            }

            if (success) {
                await channel.send('✅ Đã sao lưu dữ liệu thành công. Kênh sẽ bị xóa sau 5 giây...');
            } else {
                await channel.send('⚠️ Đã xảy ra lỗi khi lưu Transcript, nhưng kênh vẫn sẽ bị xóa sau 5 giây...');
            }

            setTimeout(async () => {
                try {
                    await channel.delete('Cưỡng chế đóng Ticket');
                } catch (err) {
                    logger.error(`[DongTicket] Lỗi xoá kênh ${channel.id}: ${err.message}`);
                }
            }, 5000);

        } catch (error) {
            logger.error(`[DongTicket] Lỗi xử lý đóng ticket: ${error.message}`);
            await channel.send('❌ Đã xảy ra lỗi hệ thống trong quá trình đóng ticket.');
        }
    },
};
