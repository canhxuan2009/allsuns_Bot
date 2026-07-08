const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');
const { hasPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('escrow_panel')
        .setDescription('Gửi bảng điều khiển Giao Dịch Trung Gian vào kênh')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Kênh để gửi panel (mặc định: kênh hiện tại)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('Đường dẫn ảnh minh hoạ đính kèm')
                .setRequired(false)),

    async execute(interaction) {
        // Kiểm tra quyền
        if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!\n💡 Cần quyền **Quản lý máy chủ** hoặc được cấp **Bot Admin**.',
                ephemeral: true,
            });
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const imageUrl = interaction.options.getString('image_url') || null;

        // Tạo embed chính
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🤝 Hỗ Trợ Giao Dịch Trung Gian')
            .setDescription(
                '**Bạn muốn giao dịch an toàn?**\n\n' +
                'Dịch vụ Trung Gian giúp bảo vệ quyền lợi của cả Người Mua và Người Bán.\n' +
                'Midman sẽ giữ tiền cho đến khi hàng hoá được giao đầy đủ.\n\n' +
                '**📋 Quy trình:**\n' +
                '> 1️⃣ Bấm nút bên dưới để tạo Ticket\n' +
                '> 2️⃣ Điền thông tin giao dịch (ID Người Bán, số tiền, loại tiền)\n' +
                '> 3️⃣ Chuyển tiền cho Midman\n' +
                '> 4️⃣ Người Bán giao hàng\n' +
                '> 5️⃣ Xác nhận & Midman giải ngân\n\n' +
                '💱 **Hỗ trợ:** VND & DonutSMP Money\n' +
                '🛡️ **Miễn phí** (hoặc phí theo nấc tùy cấu hình)\n\n' +
                '⬇️ Bấm nút bên dưới để bắt đầu!'
            )
            .setFooter({ text: `${interaction.guild.name} • Dịch vụ Trung Gian` })
            .setTimestamp();

        // Đính kèm ảnh nếu có
        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        // Nút tạo ticket
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('escrow_create_ticket')
                .setLabel('🎫 Tạo Ticket Giao Dịch')
                .setStyle(ButtonStyle.Success),
        );

        // Gửi vào kênh mục tiêu
        await targetChannel.send({ embeds: [embed], components: [row] });

        await interaction.reply({
            content: `✅ Đã gửi panel Giao Dịch Trung Gian vào <#${targetChannel.id}>!`,
            ephemeral: true,
        });
    },
};
