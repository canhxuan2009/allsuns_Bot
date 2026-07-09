const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const EscrowTicket = require('../models/escrowTicket');
const { calculateDealAmounts, formatEscrowMoney } = require('./feeCalculator');
const { isBotAdmin } = require('./settings');
const { createAndSendTranscript } = require('./transcript');
const logger = require('./logger');

// Lưu trữ tạm thời thông tin deal đang chờ Buyer xác nhận Seller (trước khi tạo kênh)
// Key: "guildId:buyerId" → Value: { sellerId, currency, amount, fee, ... }
const pendingDeals = new Map();

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Sinh mã deal ngẫu nhiên dạng E-XXXX
 */
function generateDealId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `E-${num}`;
}

/**
 * Kiểm tra user có phải Midman không (có role Midman hoặc là Bot Admin)
 */
function isMidman(member, guildId) {
    const midmanRoleId = process.env.ESCROW_MIDMAN_ROLE_ID;
    if (midmanRoleId && member.roles.cache.has(midmanRoleId)) return true;
    return isBotAdmin(guildId, member.id);
}

/**
 * Nhãn trạng thái cho embed
 */
const STATUS_LABELS = {
    SETUP:            '🔧 Đang thiết lập',
    WAITING_FUNDS:    '⏳ Chờ chuyển tiền',
    WAITING_DELIVERY: '📦 Chờ giao hàng',
    BUYER_CHECK:      '🔍 Người mua kiểm tra',
    HOLDING:          '🔒 Đang giữ tiền (Hold)',
    READY_PAYOUT:     '💸 Đã giải ngân',
    COMPLETED:        '✅ Hoàn tất',
    CANCELLED:        '❌ Đã huỷ',
};

// ─── Tạo Embed Thông Tin Deal ───────────────────────────────────────────

function buildDealEmbed(ticket, guild) {
    const statusLabel = STATUS_LABELS[ticket.status] || ticket.status;
    const currencyLabel = ticket.currency === 'VND' ? 'VND' : 'DonutSMP Money';
    const feePayerLabel = ticket.feePayer === 'BUYER' ? 'Người Mua' : 'Người Bán';

    const embed = new EmbedBuilder()
        .setColor(ticket.status === 'COMPLETED' ? 0x2ecc71 : ticket.status === 'CANCELLED' ? 0xe74c3c : 0x3498db)
        .setTitle(`🤝 Giao Dịch Trung Gian — #${ticket.dealId}`)
        .addFields(
            { name: '👤 Người Mua', value: `<@${ticket.buyerId}>`, inline: true },
            { name: '👤 Người Bán', value: ticket.sellerId ? `<@${ticket.sellerId}>` : '_Chưa xác định_', inline: true },
            { name: '🛡️ Midman', value: ticket.midmanId ? `<@${ticket.midmanId}>` : '_Chưa nhận_', inline: true },
        );

    if (ticket.amount > 0) {
        embed.addFields(
            { name: '💰 Số Tiền Giao Dịch', value: formatEscrowMoney(ticket.amount, ticket.currency), inline: true },
            { name: '💱 Loại Tiền', value: currencyLabel, inline: true },
            { name: '🧾 Phí Dịch Vụ', value: `${formatEscrowMoney(ticket.fee, ticket.currency)} (${feePayerLabel} trả)`, inline: true },
            { name: '📥 Buyer Cần Chuyển', value: `**${formatEscrowMoney(ticket.totalToPay, ticket.currency)}**`, inline: true },
            { name: '📤 Seller Thực Nhận', value: `**${formatEscrowMoney(ticket.netToReceive, ticket.currency)}**`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true }, // spacer
        );
    }

    if (ticket.description) {
        embed.addFields({ name: '📦 Mô Tả', value: ticket.description });
    }

    // Hiển thị hướng dẫn trạng thái hiện tại
    let statusNote = '';
    switch (ticket.status) {

        case 'WAITING_FUNDS':
            statusNote = `Chờ <@${ticket.buyerId}> chuyển **${formatEscrowMoney(ticket.totalToPay, ticket.currency)}** cho Midman.`;
            break;
        case 'WAITING_DELIVERY':
            statusNote = `Midman đã nhận tiền. Chờ <@${ticket.sellerId}> giao hàng.`;
            break;
        case 'BUYER_CHECK':
            statusNote = `<@${ticket.sellerId}> đã giao hàng. <@${ticket.buyerId}> hãy kiểm tra và xác nhận.`;
            break;
        case 'HOLDING':
            statusNote = 'Tiền đang được giữ lại. Midman sẽ xử lý khi đến hạn.';
            break;
        case 'READY_PAYOUT':
            statusNote = `Midman hãy chuyển **${formatEscrowMoney(ticket.netToReceive, ticket.currency)}** cho <@${ticket.sellerId}>.`;
            break;
        case 'COMPLETED':
            statusNote = '🎉 Giao dịch đã hoàn tất! Cảm ơn cả hai bên.';
            break;
        case 'CANCELLED':
            statusNote = 'Giao dịch đã bị huỷ.';
            break;
    }

    embed.addFields({ name: `Trạng Thái: ${statusLabel}`, value: statusNote });
    embed.setFooter({ text: `Deal #${ticket.dealId} • ${guild.name}` });
    embed.setTimestamp();

    return embed;
}

// ─── Tạo các nút bấm theo trạng thái ───────────────────────────────────

function buildActionButtons(ticket) {
    const rows = [];

    switch (ticket.status) {

        case 'WAITING_FUNDS': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_funds_received')
                    .setLabel('✅ Midman: Đã Nhận Tiền')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('escrow_cancel')
                    .setLabel('❌ Huỷ Giao Dịch')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
        case 'WAITING_DELIVERY': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_delivered')
                    .setLabel('📦 Seller: Đã Giao Hàng')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('escrow_cancel')
                    .setLabel('❌ Huỷ Giao Dịch')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
        case 'BUYER_CHECK': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_buyer_approve')
                    .setLabel('✅ Hàng Chuẩn — Thanh Toán')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('escrow_buyer_hold')
                    .setLabel('🔒 Yêu Cầu Giữ Tiền (Hold)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('escrow_cancel')
                    .setLabel('❌ Huỷ')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
        case 'HOLDING': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_end_hold')
                    .setLabel('🔓 Midman: Kết Thúc Hold → Giải Ngân')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('escrow_cancel')
                    .setLabel('❌ Huỷ & Hoàn Tiền')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
        case 'READY_PAYOUT': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_payout_done')
                    .setLabel('💸 Midman: Đã Chuyển Tiền Cho Seller')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('escrow_cancel')
                    .setLabel('❌ Huỷ')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
        case 'COMPLETED':
        case 'CANCELLED': {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('escrow_close_ticket')
                    .setLabel('🗑️ Midman: Đóng Kênh')
                    .setStyle(ButtonStyle.Danger),
            );
            rows.push(row);
            break;
        }
    }

    return rows;
}

/**
 * Cập nhật emoji trạng thái lên đầu tên kênh ticket
 */
async function updateTicketChannelName(channel, ticket) {
    try {
        const STATUS_EMOJIS = {
            WAITING_DELIVERY: '🟢',
            BUYER_CHECK: '🟢',     // Giữ nguyên xanh lá để tránh rate limit đổi tên
            READY_PAYOUT: '🟢',    // Giữ nguyên xanh lá để tránh rate limit đổi tên
            HOLDING: '🔒',
            COMPLETED: '⭐',
            CANCELLED: '🔴',
        };
        const emoji = STATUS_EMOJIS[ticket.status];
        
        // Tách bỏ các emoji/ký tự đặc biệt ở đầu để lấy tên gốc
        const cleanName = channel.name.replace(/^[^a-zA-Z0-9]+/, '');
        const newName = emoji ? `${emoji}-${cleanName}` : cleanName;
        
        if (channel.name !== newName) {
            await channel.setName(newName);
            logger.info(`[Escrow] Đổi tên kênh #${ticket.dealId} thành: ${newName}`);
        }
    } catch (err) {
        logger.error(`[Escrow] Lỗi đổi tên kênh #${ticket.dealId}: ${err.message}`);
    }
}

// ─── Cập nhật embed + nút trong kênh ticket ─────────────────────────────

async function refreshTicketMessage(channel, ticket, guild) {
    const embed = buildDealEmbed(ticket, guild);
    const components = buildActionButtons(ticket);

    // Tự động cập nhật emoji trạng thái lên đầu tên kênh
    updateTicketChannelName(channel, ticket);

    // Tìm tin nhắn embed đầu tiên của bot trong kênh để edit
    try {
        const messages = await channel.messages.fetch({ limit: 20 });
        const botMsg = messages.find(m =>
            m.author.id === channel.client.user.id && m.embeds.length > 0
            && m.embeds[0]?.title?.includes('Giao Dịch Trung Gian')
        );

        if (botMsg) {
            await botMsg.edit({ embeds: [embed], components });
        } else {
            await channel.send({ embeds: [embed], components });
        }
    } catch (err) {
        logger.error(`[Escrow] Lỗi refreshTicketMessage: ${err.message}`);
        // Fallback: gửi mới nếu không edit được
        await channel.send({ embeds: [embed], components });
    }
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLER CHÍNH — Xử lý tất cả Button và Modal
// ═══════════════════════════════════════════════════════════════════════

async function handleEscrowInteraction(interaction) {
    // ─── NÚT TẠO TICKET (từ Panel) ─────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'escrow_create_ticket') {
        await handleCreateTicket(interaction);
        return true;
    }



    // ─── MODAL SUBMIT ───────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'escrow_config_modal') {
        await handleConfigureSubmit(interaction);
        return true;
    }

    // ─── NÚT XÁC NHẬN / NHẬP LẠI SELLER ─────────────────────────
    if (interaction.isButton() && interaction.customId === 'escrow_confirm_seller') {
        await handleConfirmSeller(interaction);
        return true;
    }
    if (interaction.isButton() && interaction.customId === 'escrow_reconfigure_seller') {
        await handleReconfigureSeller(interaction);
        return true;
    }

    // ─── CÁC NÚT TRẠNG THÁI ────────────────────────────────────
    const escrowButtons = [
        'escrow_funds_received',
        'escrow_delivered',
        'escrow_buyer_approve',
        'escrow_buyer_hold',
        'escrow_end_hold',
        'escrow_payout_done',
        'escrow_close_ticket',
        'escrow_cancel',
    ];

    if (interaction.isButton() && escrowButtons.includes(interaction.customId)) {
        await handleStatusButton(interaction);
        return true;
    }

    return false; // Không phải interaction của escrow
}

// ─── Tạo Ticket — Hiển thị Modal ngay tại kênh Panel ───────────────────

async function handleCreateTicket(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('escrow_config_modal')
        .setTitle('⚙️ Cấu Hình Giao Dịch Trung Gian');

    const sellerInput = new TextInputBuilder()
        .setCustomId('seller_id')
        .setLabel('ID hoặc Username Người Bán')
        .setPlaceholder('VD: spencer_01 hoặc 123456789012345678')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const currencyInput = new TextInputBuilder()
        .setCustomId('currency')
        .setLabel('Loại tiền: VND hoặc DONUT')
        .setPlaceholder('VND')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(5)
        .setRequired(true);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Số tiền giao dịch (chỉ nhập số)')
        .setPlaceholder('VD: 500000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const feePayerInput = new TextInputBuilder()
        .setCustomId('fee_payer')
        .setLabel('Bên chịu phí: BUYER hoặc SELLER')
        .setPlaceholder('BUYER')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(6)
        .setRequired(true);

    const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Mô tả hàng hoá / dịch vụ')
        .setPlaceholder('VD: Bán 1 set giáp Netherite + sword')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(sellerInput),
        new ActionRowBuilder().addComponents(currencyInput),
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(feePayerInput),
        new ActionRowBuilder().addComponents(descInput),
    );

    await interaction.showModal(modal);
}

// ─── Xử Lý Modal Submit (tại kênh Panel — ephemeral) ───────────────────

async function handleConfigureSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Parse input
    const sellerInputRaw = interaction.fields.getTextInputValue('seller_id').trim().replace(/^@/, '');
    const currencyRaw = interaction.fields.getTextInputValue('currency').trim().toUpperCase();
    const amountRaw = interaction.fields.getTextInputValue('amount').trim().replace(/[.,\s]/g, '');
    const feePayerRaw = interaction.fields.getTextInputValue('fee_payer').trim().toUpperCase();
    const description = interaction.fields.getTextInputValue('description').trim();

    // Validate
    const errors = [];
    if (!['VND', 'DONUT'].includes(currencyRaw)) {
        errors.push('❌ **Loại tiền** phải là `VND` hoặc `DONUT`.');
    }
    const amount = parseInt(amountRaw, 10);
    if (isNaN(amount) || amount <= 0) {
        errors.push('❌ **Số tiền** phải là số nguyên dương.');
    }
    if (!['BUYER', 'SELLER'].includes(feePayerRaw)) {
        errors.push('❌ **Bên chịu phí** phải là `BUYER` hoặc `SELLER`.');
    }
    if (errors.length > 0) {
        return interaction.editReply({ content: errors.join('\n') });
    }

    // ── Tìm kiếm Seller: hỗ trợ cả ID và Username ──────────────
    let sellerMember;
    const isNumericId = /^\d{15,20}$/.test(sellerInputRaw);

    if (isNumericId) {
        try {
            sellerMember = await interaction.guild.members.fetch(sellerInputRaw);
        } catch {
            return interaction.editReply({ content: '❌ Không tìm thấy người bán với ID này trong server.' });
        }
    } else {
        if (sellerInputRaw.length < 2 || sellerInputRaw.length > 32) {
            return interaction.editReply({ content: '❌ Tên người dùng phải từ 2 đến 32 ký tự.' });
        }
        try {
            const searchResults = await interaction.guild.members.fetch({ query: sellerInputRaw, limit: 5 });
            if (searchResults.size === 0) {
                return interaction.editReply({ content: `❌ Không tìm thấy thành viên nào có tên "**${sellerInputRaw}**" trong server.` });
            }
            sellerMember = searchResults.find(m => m.user.username.toLowerCase() === sellerInputRaw.toLowerCase())
                        || searchResults.first();
        } catch {
            return interaction.editReply({ content: '❌ Lỗi khi tìm kiếm thành viên. Vui lòng thử lại.' });
        }
    }

    if (sellerMember.id === interaction.user.id) {
        return interaction.editReply({ content: '❌ Bạn không thể tự giao dịch với chính mình.' });
    }
    if (sellerMember.user.bot) {
        return interaction.editReply({ content: '❌ Không thể giao dịch với bot.' });
    }

    // Tính phí
    const { fee, totalToPay, netToReceive } = calculateDealAmounts(currencyRaw, amount, feePayerRaw);

    // Lưu vào pendingDeals Map (chờ Buyer xác nhận trước khi tạo kênh)
    const pendingKey = `${interaction.guild.id}:${interaction.user.id}`;
    pendingDeals.set(pendingKey, {
        guildId: interaction.guild.id,
        buyerId: interaction.user.id,
        buyerTag: interaction.user.tag,
        sellerId: sellerMember.id,
        currency: currencyRaw,
        amount,
        fee,
        feePayer: feePayerRaw,
        totalToPay,
        netToReceive,
        description,
        clientUser: interaction.client.user,
    });

    // Tự xoá sau 15 phút nếu không xác nhận (tránh rò rỉ bộ nhớ)
    setTimeout(() => {
        if (pendingDeals.has(pendingKey)) {
            pendingDeals.delete(pendingKey);
            logger.info(`[Escrow] Pending deal của user ${interaction.user.id} đã hết hạn (15 phút).`);
        }
    }, 15 * 60 * 1000);

    // ── Tạo Embed preview Seller (ephemeral — chỉ Buyer thấy) ───
    const sellerUser = sellerMember.user;
    const createdAt = sellerUser.createdAt;
    const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const feePayerLabel = feePayerRaw === 'BUYER' ? 'Người Mua' : 'Người Bán';

    const previewEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🔍 Xác Nhận Người Bán')
        .setDescription(
            '**Vui lòng kiểm tra kỹ thông tin Người Bán bên dưới.**\n' +
            'Nếu đúng người, bấm **✅ Xác Nhận**. Nếu sai, bấm **❌ Nhập Lại** để cấu hình lại.'
        )
        .setThumbnail(sellerUser.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: '👤 Tên hiển thị', value: sellerMember.displayName, inline: true },
            { name: '📛 Username', value: `@${sellerUser.username}`, inline: true },
            { name: '🆔 User ID', value: `\`${sellerMember.id}\``, inline: true },
            { name: '📅 Ngày tạo tài khoản', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:D> (${accountAge} ngày trước)`, inline: true },
            { name: '💰 Số tiền giao dịch', value: formatEscrowMoney(amount, currencyRaw), inline: true },
            { name: '🧾 Phí dịch vụ', value: `${formatEscrowMoney(fee, currencyRaw)} (${feePayerLabel} trả)`, inline: true },
            { name: '📦 Mô tả', value: description },
        )
        .setFooter({ text: 'Chờ xác nhận Người Bán • Hết hạn sau 15 phút' })
        .setTimestamp();

    if (accountAge < 30) {
        previewEmbed.addFields({
            name: '⚠️ CẢNH BÁO',
            value: `Tài khoản này mới được tạo **${accountAge} ngày** trước. Hãy cẩn thận với các tài khoản mới!`
        });
    }

    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('escrow_confirm_seller')
            .setLabel('✅ Xác Nhận - Đúng Người')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('escrow_reconfigure_seller')
            .setLabel('❌ Nhập Lại')
            .setStyle(ButtonStyle.Danger),
    );

    // Gửi ephemeral (chỉ Buyer thấy tại kênh panel)
    await interaction.editReply({ embeds: [previewEmbed], components: [confirmRow] });

    logger.info(`[Escrow] ${interaction.user.tag} đang xác nhận Seller @${sellerUser.username} (${sellerMember.id}) tại panel`);
}

// ─── Xử Lý Nút Xác Nhận Seller → Tạo Kênh Ticket ──────────────────────

async function handleConfirmSeller(interaction) {
    const pendingKey = `${interaction.guild.id}:${interaction.user.id}`;
    const dealData = pendingDeals.get(pendingKey);

    if (!dealData) {
        return interaction.update({
            content: '❌ Phiên thiết lập đã hết hạn hoặc không tồn tại.\nVui lòng bấm lại nút **Tạo Ticket Giao Dịch** trên panel để bắt đầu lại.',
            embeds: [],
            components: [],
        });
    }

    // Cập nhật ephemeral: đang xử lý
    await interaction.update({
        content: '⏳ Đang tạo kênh giao dịch...',
        embeds: [],
        components: [],
    });

    const guild = interaction.guild;
    const buyer = interaction.member;
    const categoryId = process.env.ESCROW_CATEGORY_ID;

    // Sinh dealId duy nhất
    let dealId;
    let attempts = 0;
    do {
        dealId = generateDealId();
        const existing = await EscrowTicket.findOne({ guildId: guild.id, dealId });
        if (!existing) break;
        attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
        pendingDeals.delete(pendingKey);
        return interaction.editReply({ content: '❌ Không thể tạo mã deal. Vui lòng thử lại!' });
    }

    try {
        // Tạo kênh ticket (Buyer + Seller + Bot + Midman Role đều có quyền từ đầu)
        const channelOptions = {
            name: `deal-${buyer.displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${dealId.toLowerCase()}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: buyer.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                },
                {
                    id: dealData.sellerId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels],
                },
            ],
        };

        const midmanRoleId = process.env.ESCROW_MIDMAN_ROLE_ID;
        if (midmanRoleId) {
            channelOptions.permissionOverwrites.push({
                id: midmanRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
            });
        }

        if (categoryId) {
            channelOptions.parent = categoryId;
        }

        const ticketChannel = await guild.channels.create(channelOptions);

        // Lưu vào database — trạng thái WAITING_FUNDS ngay từ đầu (bỏ qua SETUP)
        const ticket = await EscrowTicket.create({
            guildId: guild.id,
            channelId: ticketChannel.id,
            dealId,
            buyerId: buyer.id,
            sellerId: dealData.sellerId,
            currency: dealData.currency,
            amount: dealData.amount,
            fee: dealData.fee,
            feePayer: dealData.feePayer,
            totalToPay: dealData.totalToPay,
            netToReceive: dealData.netToReceive,
            description: dealData.description,
            status: 'WAITING_FUNDS',
        });

        // Cập nhật tên kênh với emoji trạng thái
        await updateTicketChannelName(ticketChannel, ticket);

        // Gửi embed deal trong kênh mới
        const embed = buildDealEmbed(ticket, guild);
        const components = buildActionButtons(ticket);

        const midmanPing = midmanRoleId ? `<@&${midmanRoleId}>` : '';
        await ticketChannel.send({
            content: `🎫 **Ticket Giao Dịch Mới — #${dealId}**\n${buyer} (Buyer) và <@${dealData.sellerId}> (Seller) ${midmanPing}\n\n💰 Chờ ${buyer} chuyển **${formatEscrowMoney(dealData.totalToPay, dealData.currency)}** cho Midman.`,
            embeds: [embed],
            components,
        });

        // Cập nhật tin nhắn ephemeral cho Buyer
        await interaction.editReply({
            content: `✅ Đã tạo ticket giao dịch thành công!\n👉 Vào <#${ticketChannel.id}> để tiếp tục giao dịch.`,
        });

        // Xoá pending deal
        pendingDeals.delete(pendingKey);

        logger.info(`[Escrow] Ticket #${dealId} được tạo bởi ${buyer.user.tag}, Seller: ${dealData.sellerId}, ${dealData.amount} ${dealData.currency}`);

    } catch (err) {
        logger.error(`[Escrow] Lỗi tạo ticket: ${err.message}`);
        pendingDeals.delete(pendingKey);
        await interaction.editReply({ content: `❌ Không thể tạo ticket: ${err.message}` });
    }
}

// ─── Xử Lý Nút Nhập Lại ────────────────────────────────────────────────

async function handleReconfigureSeller(interaction) {
    const pendingKey = `${interaction.guild.id}:${interaction.user.id}`;
    pendingDeals.delete(pendingKey);

    await interaction.update({
        content: '🔄 Đã huỷ thiết lập. Bấm lại nút **Tạo Ticket Giao Dịch** trên panel để bắt đầu lại.',
        embeds: [],
        components: [],
    });

    logger.info(`[Escrow] ${interaction.user.tag} đã huỷ thiết lập deal tại panel.`);
}


// ─── Xử Lý Các Nút Trạng Thái ──────────────────────────────────────────

async function handleStatusButton(interaction) {
    const ticket = await EscrowTicket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
        return interaction.reply({ content: '❌ Không tìm thấy thông tin deal trong kênh này.', ephemeral: true });
    }

    const userId = interaction.user.id;
    const isMidmanUser = isMidman(interaction.member, interaction.guild.id);
    const isBuyer = userId === ticket.buyerId;
    const isSeller = userId === ticket.sellerId;

    switch (interaction.customId) {

        // ── Midman: Đã Nhận Tiền ────────────────────────────────────
        case 'escrow_funds_received': {
            if (!isMidmanUser) {
                return interaction.reply({ content: '❌ Chỉ Midman mới có thể xác nhận nhận tiền.', ephemeral: true });
            }
            if (ticket.status !== 'WAITING_FUNDS') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'WAITING_DELIVERY';
            ticket.midmanId = userId;
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(`✅ <@${userId}> (Midman) đã xác nhận nhận tiền. Chờ <@${ticket.sellerId}> giao hàng.`);
            logger.info(`[Escrow] Deal #${ticket.dealId}: Midman ${interaction.user.tag} đã nhận tiền.`);
            break;
        }

        // ── Seller: Đã Giao Hàng ────────────────────────────────────
        case 'escrow_delivered': {
            if (!isSeller) {
                return interaction.reply({ content: '❌ Chỉ Người Bán mới có thể xác nhận giao hàng.', ephemeral: true });
            }
            if (ticket.status !== 'WAITING_DELIVERY') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'BUYER_CHECK';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(`📦 <@${ticket.sellerId}> đã giao hàng. <@${ticket.buyerId}> hãy kiểm tra và xác nhận.`);
            logger.info(`[Escrow] Deal #${ticket.dealId}: Seller đã giao hàng.`);
            break;
        }

        // ── Buyer: Hàng Chuẩn → Giải Ngân ───────────────────────────
        case 'escrow_buyer_approve': {
            if (!isBuyer) {
                return interaction.reply({ content: '❌ Chỉ Người Mua mới có thể xác nhận.', ephemeral: true });
            }
            if (ticket.status !== 'BUYER_CHECK') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'READY_PAYOUT';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(
                `✅ <@${ticket.buyerId}> đã xác nhận hàng chuẩn.\n` +
                `💸 Midman hãy chuyển **${formatEscrowMoney(ticket.netToReceive, ticket.currency)}** cho <@${ticket.sellerId}>.`
            );
            logger.info(`[Escrow] Deal #${ticket.dealId}: Buyer approve → READY_PAYOUT.`);
            break;
        }

        // ── Buyer: Yêu Cầu Giữ Tiền (Hold) ─────────────────────────
        case 'escrow_buyer_hold': {
            if (!isBuyer) {
                return interaction.reply({ content: '❌ Chỉ Người Mua mới có thể yêu cầu hold.', ephemeral: true });
            }
            if (ticket.status !== 'BUYER_CHECK') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'HOLDING';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(
                `🔒 <@${ticket.buyerId}> đã yêu cầu **giữ tiền (Hold)**.\n` +
                `Midman sẽ giữ tiền cho đến khi hai bên thống nhất.`
            );
            logger.info(`[Escrow] Deal #${ticket.dealId}: Buyer yêu cầu HOLD.`);
            break;
        }

        // ── Midman: Kết Thúc Hold → Giải Ngân ──────────────────────
        case 'escrow_end_hold': {
            if (!isMidmanUser) {
                return interaction.reply({ content: '❌ Chỉ Midman mới có thể kết thúc hold.', ephemeral: true });
            }
            if (ticket.status !== 'HOLDING') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'READY_PAYOUT';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(
                `🔓 Midman đã kết thúc hold.\n` +
                `💸 Hãy chuyển **${formatEscrowMoney(ticket.netToReceive, ticket.currency)}** cho <@${ticket.sellerId}>.`
            );
            logger.info(`[Escrow] Deal #${ticket.dealId}: Midman end hold → READY_PAYOUT.`);
            break;
        }

        // ── Midman: Đã Chuyển Tiền → Hoàn Tất ──────────────────────
        case 'escrow_payout_done': {
            if (!isMidmanUser) {
                return interaction.reply({ content: '❌ Chỉ Midman mới có thể xác nhận giải ngân.', ephemeral: true });
            }
            if (ticket.status !== 'READY_PAYOUT') {
                return interaction.reply({ content: '❌ Trạng thái deal không phù hợp.', ephemeral: true });
            }

            await interaction.deferUpdate();
            ticket.status = 'COMPLETED';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(
                `🎉 **Giao dịch #${ticket.dealId} đã hoàn tất!**\n` +
                `💰 **${formatEscrowMoney(ticket.netToReceive, ticket.currency)}** đã được chuyển cho <@${ticket.sellerId}>.\n` +
                `Cảm ơn <@${ticket.buyerId}> và <@${ticket.sellerId}> đã sử dụng dịch vụ trung gian! 🤝`
            );
            logger.info(`[Escrow] Deal #${ticket.dealId}: COMPLETED.`);
            break;
        }

        // ── Midman: Đóng Kênh ───────────────────────────────────────
        case 'escrow_close_ticket': {
            if (!isMidmanUser) {
                return interaction.reply({ content: '❌ Chỉ Midman mới có thể đóng kênh.', ephemeral: true });
            }

            const logChannelId = process.env.ESCROW_SUMMARY_CHANNEL_ID || process.env.ESCROW_HTML_CHANNEL_ID || process.env.ESCROW_ATTACHMENT_CHANNEL_ID || process.env.ESCROW_LOG_CHANNEL_ID;
            if (logChannelId) {
                await interaction.reply({ content: '⏳ Đang sao lưu cuộc trò chuyện và đóng kênh...' });
                const success = await createAndSendTranscript(interaction.channel, ticket, logChannelId);
                if (!success) {
                    await interaction.followUp({ content: '⚠️ Gặp lỗi khi sao lưu Transcript, nhưng kênh vẫn sẽ bị xoá sau 5 giây...' });
                }
            } else {
                await interaction.reply({ content: '🗑️ Kênh sẽ bị xoá sau 5 giây... (Chưa cấu hình kênh lưu trữ Transcript)' });
            }

            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                    logger.info(`[Escrow] Deal #${ticket.dealId}: Kênh đã bị xoá bởi ${interaction.user.tag}.`);
                } catch (err) {
                    logger.error(`[Escrow] Lỗi xoá kênh: ${err.message}`);
                }
            }, 5_000);
            break;
        }

        // ── Huỷ Giao Dịch ───────────────────────────────────────────
        case 'escrow_cancel': {
            if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') {
                return interaction.reply({ content: '❌ Deal này đã kết thúc, không thể huỷ.', ephemeral: true });
            }

            // Nếu trạng thái đã qua bước nhận tiền (đã có tiền chuyển cho Midman)
            const isFundsHeld = !['SETUP', 'WAITING_FUNDS'].includes(ticket.status);

            if (isFundsHeld) {
                // Chỉ Midman được phép huỷ khi tiền đã được chuyển cho Midman
                if (!isMidmanUser) {
                    return interaction.reply({
                        content: '❌ Midman đã giữ tiền cho giao dịch này. Chỉ Midman mới có quyền huỷ và thực hiện hoàn tiền.',
                        ephemeral: true
                    });
                }
            } else {
                // Ở trạng thái SETUP hoặc WAITING_FUNDS, Buyer, Seller hoặc Midman đều huỷ được
                if (!isBuyer && !isSeller && !isMidmanUser) {
                    return interaction.reply({ content: '❌ Bạn không có quyền huỷ deal này.', ephemeral: true });
                }
            }

            await interaction.deferUpdate();
            ticket.status = 'CANCELLED';
            await ticket.save();

            await refreshTicketMessage(interaction.channel, ticket, interaction.guild);
            await interaction.channel.send(
                `❌ **Giao dịch #${ticket.dealId} đã bị huỷ** bởi <@${userId}>.\n` +
                `Nếu Midman đã nhận tiền, vui lòng hoàn trả lại cho Người Mua.`
            );
            logger.info(`[Escrow] Deal #${ticket.dealId}: CANCELLED bởi ${interaction.user.tag}.`);
            break;
        }
    }
}

module.exports = {
    handleEscrowInteraction,
};
