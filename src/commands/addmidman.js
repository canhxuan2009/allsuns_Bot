const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Midman = require('../models/midman');
const { isBotAdmin } = require('../utils/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addmidman')
        .setDescription('Đăng ký hoặc cập nhật thông tin thanh toán cho một Midman (Chỉ Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Thành viên có role Midman cần đăng ký')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Tên Midman hiển thị trên hoá đơn (VD: Xuan Nguyen)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('bank')
                .setDescription('Tên ngân hàng (VD: MB, Vietcombank, Techcombank)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('holder')
                .setDescription('Tên chủ tài khoản (Chữ HOA không dấu, VD: NGUYEN VAN A)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('number')
                .setDescription('Số tài khoản ngân hàng')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('qr_url')
                .setDescription('URL trực tiếp tới ảnh QR tĩnh (tuỳ chọn). Nếu bỏ trống, bot sẽ tự tạo QR.')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Kiểm tra quyền: Phải là Admin Discord hoặc Bot Admin
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator)
            || isBotAdmin(interaction.guildId, interaction.user.id);

        if (!isAdmin) {
            return interaction.reply({
                content: '❌ Chỉ quản trị viên mới có thể sử dụng lệnh này!',
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser('user');
        const displayName  = interaction.options.getString('name');
        const bankName     = interaction.options.getString('bank').toUpperCase();
        const accountHolder = interaction.options.getString('holder').toUpperCase();
        const accountNumber = interaction.options.getString('number').trim();
        const qrUrl        = interaction.options.getString('qr_url') || null;

        // Kiểm tra target không phải bot
        if (targetUser.bot) {
            return interaction.reply({
                content: '❌ Không thể đăng ký thông tin cho bot!',
                ephemeral: true,
            });
        }

        // Kiểm tra target có phải Midman không
        const midmanRoleId = process.env.ESCROW_MIDMAN_ROLE_ID;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (midmanRoleId && targetMember && !targetMember.roles.cache.has(midmanRoleId)) {
            return interaction.reply({
                content: `❌ <@${targetUser.id}> không có role Midman. Chỉ có thể đăng ký cho thành viên có role Midman.`,
                ephemeral: true,
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Upsert — tạo mới hoặc cập nhật nếu đã tồn tại
            await Midman.findOneAndUpdate(
                { guildId: interaction.guildId, userId: targetUser.id },
                {
                    displayName,
                    bankName,
                    accountHolder,
                    accountNumber,
                    qrUrl,
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Đã cập nhật thông tin Midman')
                .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
                .addFields(
                    { name: '👤 Midman', value: `<@${targetUser.id}>`, inline: true },
                    { name: '📛 Tên hiển thị', value: displayName, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🏦 Ngân hàng', value: bankName, inline: true },
                    { name: '👤 Chủ tài khoản', value: accountHolder, inline: true },
                    { name: '💳 Số tài khoản', value: `\`${accountNumber}\``, inline: true },
                    { name: '🖼️ QR tĩnh', value: qrUrl ? `[Xem ảnh](${qrUrl})` : '_Không đăng ký — Bot sẽ tự tạo QR động_' },
                )
                .setFooter({ text: `Đăng ký bởi ${interaction.user.tag}` })
                .setTimestamp();

            if (qrUrl) embed.setImage(qrUrl);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: `❌ Lỗi khi lưu dữ liệu: ${err.message}` });
        }
    },
};
