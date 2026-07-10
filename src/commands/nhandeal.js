const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EscrowTicket = require('../models/escrowTicket');
const Midman = require('../models/midman');
const { formatEscrowMoney } = require('../utils/feeCalculator');
const { isBotAdmin } = require('../utils/settings');

// Kiểm tra user có phải Midman không
function isMidman(member, guildId) {
    const midmanRoleId = process.env.ESCROW_MIDMAN_ROLE_ID;
    if (midmanRoleId && member.roles.cache.has(midmanRoleId)) return true;
    return isBotAdmin(guildId, member.id);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nhandeal')
        .setDescription('Nhận deal và gửi thông tin thanh toán cho người mua (Chỉ dành cho Midman)'),

    async execute(interaction) {
        // 1. Kiểm tra quyền
        if (!isMidman(interaction.member, interaction.guildId)) {
            return interaction.reply({
                content: '❌ Chỉ Midman mới có thể sử dụng lệnh này!',
                ephemeral: true,
            });
        }

        // 2. Tìm ticket từ channel hiện tại
        const ticket = await EscrowTicket.findOne({ channelId: interaction.channelId });
        if (!ticket) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ dùng được trong kênh Ticket Deal đang hoạt động.',
                ephemeral: true,
            });
        }

        if (ticket.status !== 'WAITING_FUNDS') {
            return interaction.reply({
                content: '❌ Chỉ có thể gửi thông tin thanh toán khi giao dịch đang ở trạng thái **⏳ Chờ chuyển tiền**.',
                ephemeral: true,
            });
        }

        // 3. Tìm cấu hình ngân hàng của Midman này
        const midmanConfig = await Midman.findOne({
            guildId: interaction.guildId,
            userId: interaction.user.id,
        });

        if (!midmanConfig) {
            return interaction.reply({
                content: `❌ Bạn chưa đăng ký thông tin tài khoản thanh toán.\nVui lòng liên hệ Admin để được đăng ký bằng lệnh \`/addmidman\`.`,
                ephemeral: true,
            });
        }

        // 4. Phân loại loại tiền và gửi thông tin
        if (ticket.currency === 'VND') {
            const totalAmount = ticket.totalToPay;

            // Ưu tiên QR tĩnh nếu có; nếu không, tự tạo VietQR động
            let qrImageUrl;
            if (midmanConfig.qrUrl) {
                qrImageUrl = midmanConfig.qrUrl;
            } else {
                qrImageUrl = `https://img.vietqr.io/image/${midmanConfig.bankName}-${midmanConfig.accountNumber}-print.png?amount=${totalAmount}&addInfo=${encodeURIComponent(ticket.dealId)}&accountName=${encodeURIComponent(midmanConfig.accountHolder)}`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('💳 Thông Tin Thanh Toán')
                .setDescription(`**Midman ${interaction.user} đã nhận xử lý giao dịch này!**\nVui lòng thanh toán theo thông tin bên dưới và gửi ảnh biên lai vào kênh này để Midman kiểm tra.`)
                .addFields(
                    { name: '👤 Midman', value: midmanConfig.displayName, inline: true },
                    { name: '🏦 Ngân hàng', value: midmanConfig.bankName, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💳 Số tài khoản', value: `\`\`\`${midmanConfig.accountNumber}\`\`\``, inline: true },
                    { name: '👤 Chủ tài khoản', value: `\`\`\`${midmanConfig.accountHolder}\`\`\``, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💰 Số tiền cần chuyển', value: `**${formatEscrowMoney(totalAmount, 'VND')}**`, inline: true },
                    { name: '📝 Nội dung chuyển khoản', value: `\`\`\`${ticket.dealId}\`\`\``, inline: true },
                )
                .setImage(qrImageUrl)
                .setFooter({ text: `Deal #${ticket.dealId} • Vui lòng chuyển đúng nội dung để dễ xác nhận` })
                .setTimestamp();

            await interaction.reply({
                content: `📢 <@${ticket.buyerId}> — Vui lòng hoàn tất thanh toán để giao dịch tiếp tục!`,
                embeds: [embed],
            });

        } else if (ticket.currency === 'DONUT') {
            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('💳 Hướng Dẫn Thanh Toán (Tiền Game)')
                .setDescription(`**Midman ${interaction.user} đã nhận xử lý giao dịch này!**\nVui lòng vào game Minecraft và gõ lệnh sau để chuyển tiền cho Midman:`)
                .addFields(
                    { name: '🎮 Lệnh chuyển tiền', value: `\`\`\`/pay ${midmanConfig.displayName} ${ticket.totalToPay}\`\`\`` },
                    { name: '💰 Số tiền', value: `**${formatEscrowMoney(ticket.totalToPay, 'DONUT')}**`, inline: true },
                    { name: '👤 Tên Midman', value: midmanConfig.displayName, inline: true },
                )
                .setFooter({ text: `Deal #${ticket.dealId} • Chụp màn hình sau khi chuyển và gửi vào kênh này` })
                .setTimestamp();

            await interaction.reply({
                content: `📢 <@${ticket.buyerId}> — Vui lòng hoàn tất thanh toán để giao dịch tiếp tục!`,
                embeds: [embed],
            });

        } else {
            return interaction.reply({
                content: '❌ Lỗi: Loại tiền tệ không hợp lệ.',
                ephemeral: true,
            });
        }
    },
};
