const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isBotAdmin } = require('../utils/settings');
const shopProducts = require('../config/shopProducts');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Mở bảng điều khiển Shop Bán Tài Khoản (Admin Only)'),

    async execute(interaction) {
        // Chỉ cho phép admin sử dụng
        if (!isBotAdmin(interaction.guildId, interaction.user.id)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này.',
                ephemeral: true,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🛒 Shop Tài Khoản Premium')
            .setDescription('Chào mừng bạn đến với Shop! Vui lòng chọn sản phẩm bạn muốn mua từ menu bên dưới.\n\nSau khi chọn, hệ thống sẽ hướng dẫn bạn tạo ticket thanh toán và nhận hàng.')
            .setImage('https://cdn.discordapp.com/attachments/1524083621512613918/1524084097637679205/image.png?ex=6a54642c&is=6a5312ac&hm=2bd5e8ac7a575a1c4a9db6de5676b23d51766f63f2535e55704a6324510b43f8&') // Bạn có thể thay đổi ảnh này nếu muốn
            .setFooter({ text: 'AllSuns Shop System' })
            .setTimestamp();

        const options = shopProducts.map(product => ({
            label: product.label,
            description: `${product.price.toLocaleString('vi-VN')} VND - ${product.description.substring(0, 50)}...`,
            value: product.id,
            emoji: product.emoji || '📦'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('shop_product_select')
            .setPlaceholder('Vui lòng chọn sản phẩm...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await interaction.reply({
            content: '✅ Đã gửi bảng điều khiển Shop thành công!',
            ephemeral: true
        });
    },
};
