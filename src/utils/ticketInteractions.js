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
const SupportTicket = require('../models/ticket');
const { createAndSendTicketTranscript } = require('./ticketTranscript');
const logger = require('./logger');

function generateTicketId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `T-${num}`;
}

async function handleTicketInteraction(interaction) {
    if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'ticket_create_support') {
            await createTicketChannel(interaction, 'SUPPORT');
        } 
        else if (customId === 'ticket_create_warranty') {
            const modal = new ModalBuilder()
                .setCustomId('ticket_warranty_modal')
                .setTitle('Thông tin bảo hành');

            const productInput = new TextInputBuilder()
                .setCustomId('product_name')
                .setLabel('Tên sản phẩm')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const dateInput = new TextInputBuilder()
                .setCustomId('purchase_date')
                .setLabel('Ngày mua (Không bắt buộc)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(productInput),
                new ActionRowBuilder().addComponents(dateInput)
            );

            await interaction.showModal(modal);
        }
        else if (customId === 'ticket_close') {
            await closeTicket(interaction);
        }
    } 
    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_warranty_modal') {
            const productName = interaction.fields.getTextInputValue('product_name');
            let purchaseDate = null;
            try {
                purchaseDate = interaction.fields.getTextInputValue('purchase_date');
            } catch (e) {
                // Not required, ignore if error
            }
            await createTicketChannel(interaction, 'WARRANTY', productName, purchaseDate);
        }
    }
}

async function createTicketChannel(interaction, type, productName = null, purchaseDate = null) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const guild = interaction.guild;
        const user = interaction.user;
        const ticketId = generateTicketId();

        const categoryId = process.env.TICKET_CATEGORY_ID || process.env.ESCROW_CATEGORY_ID;
        const pingRoleId = process.env.TICKET_PING_ROLE_ID;

        // Định dạng tên kênh theo loại
        const prefix = type === 'WARRANTY' ? 'warranty' : 'support';
        const channelName = `${prefix}-${ticketId}`;

        // Cấp quyền cho user tạo và pingRole
        const permissionOverwrites = [
            {
                id: guild.id, // @everyone
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                ],
            }
        ];

        if (pingRoleId) {
            permissionOverwrites.push({
                id: pingRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                ],
            });
        }

        const channelOptions = {
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: permissionOverwrites,
            reason: `Tạo Ticket ${type} cho ${user.tag}`
        };

        const channel = await guild.channels.create(channelOptions);

        // Lưu Database
        const ticket = new SupportTicket({
            ticketId,
            channelId: channel.id,
            creatorId: user.id,
            ticketType: type,
            productName,
            purchaseDate
        });
        await ticket.save();

        // Gửi tin nhắn chào mừng trong kênh ticket
        const embed = new EmbedBuilder()
            .setColor(type === 'WARRANTY' ? 0x2ecc71 : 0x3498db)
            .setTitle(type === 'WARRANTY' ? `🛡️ Ticket Bảo Hành #${ticketId}` : `🛠️ Ticket Hỗ Trợ #${ticketId}`)
            .setDescription(`Xin chào <@${user.id}>, đội ngũ hỗ trợ sẽ sớm có mặt.\nVui lòng mô tả chi tiết vấn đề của bạn ở đây.`)
            .setTimestamp();

        if (type === 'WARRANTY') {
            embed.addFields(
                { name: 'Sản phẩm', value: productName || 'N/A', inline: true },
                { name: 'Ngày mua', value: purchaseDate || 'Không có', inline: true }
            );
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Đóng Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        const pingContent = pingRoleId ? `<@&${pingRoleId}>` : '';
        await channel.send({ content: `${pingContent} <@${user.id}>`, embeds: [embed], components: [row] });

        await interaction.editReply(`✅ Đã tạo Ticket thành công tại <#${channel.id}>`);
    } catch (error) {
        logger.error(`[Ticket] Lỗi tạo ticket channel: ${error.message}`);
        await interaction.editReply('❌ Đã xảy ra lỗi khi tạo Ticket. Vui lòng thử lại sau.');
    }
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    
    const ticket = await SupportTicket.findOne({ channelId: channel.id, status: 'OPEN' });
    if (!ticket) {
        return interaction.reply({ content: '❌ Không tìm thấy thông tin Ticket hoặc Ticket đã đóng!', ephemeral: true });
    }

    // Kiểm tra quyền: Người tạo hoặc Admin/Role có quyền mới được đóng
    const hasAdminPerm = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const pingRoleId = process.env.TICKET_PING_ROLE_ID;
    const hasRole = pingRoleId && interaction.member.roles.cache.has(pingRoleId);

    if (interaction.user.id !== ticket.creatorId && !hasAdminPerm && !hasRole) {
        return interaction.reply({ content: '❌ Bạn không có quyền đóng Ticket này.', ephemeral: true });
    }

    await interaction.reply('🔒 *Đang tiến hành đóng ticket và tạo bản lưu (Transcript)...*');

    ticket.status = 'CLOSED';
    await ticket.save();

    // Tạo transcript và gửi
    const success = await createAndSendTicketTranscript(channel, ticket);
    
    if (success) {
        await channel.send('✅ Đã sao lưu dữ liệu thành công. Kênh sẽ bị xóa sau 5 giây...');
    } else {
        await channel.send('⚠️ Đã xảy ra lỗi khi lưu Transcript, nhưng kênh vẫn sẽ bị xóa sau 5 giây...');
    }

    setTimeout(async () => {
        try {
            await channel.delete('Đóng Ticket');
        } catch (err) {
            logger.error(`[Ticket] Lỗi xoá kênh ${channel.id}: ${err.message}`);
        }
    }, 5000);
}

module.exports = { handleTicketInteraction };
