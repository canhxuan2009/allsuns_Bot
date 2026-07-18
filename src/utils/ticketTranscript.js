const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const logger = require('./logger');
const fs = require('fs');

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

async function createAndSendTicketTranscript(channel, ticket) {
    try {
        const client = channel.client;
        
        // Dùng chung kênh log với Escrow/Shop
        const logChannelId = process.env.ESCROW_SUMMARY_CHANNEL_ID;
        const htmlChannelId = process.env.ESCROW_HTML_CHANNEL_ID || logChannelId;
        
        const summaryChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;
        const htmlChannel = htmlChannelId ? await client.channels.fetch(htmlChannelId).catch(() => null) : null;

        await channel.send('⏳ *Đang sao lưu lịch sử chat...*');

        let allMessages = [];
        let lastId = null;

        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;

            const fetched = await channel.messages.fetch(options);
            if (fetched.size === 0) break;

            allMessages.push(...fetched.values());
            lastId = fetched.lastKey();

            if (fetched.size < 100 || allMessages.length >= 200) break;
        }

        allMessages.reverse();

        const creator = await client.users.fetch(ticket.creatorId).catch(() => null);
        const creatorTag = creator ? creator.tag : ticket.creatorId;
        const ticketTypeLabel = ticket.ticketType === 'WARRANTY' ? 'Bảo Hành' : 'Hỗ Trợ';

        let htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lịch sử ${ticketTypeLabel} #${ticket.ticketId}</title>
    <style>
        body { background-color: #313338; color: #dbdee1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
        .header { background-color: #1e1f22; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 5px solid #3498db; }
        .header h1 { margin-top: 0; color: #ffffff; font-size: 24px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
        .grid-item { background: #2b2d31; padding: 10px 15px; border-radius: 6px; border: 1px solid #3f4147; }
        .grid-item span { display: block; font-size: 12px; color: #949ba4; text-transform: uppercase; font-weight: bold; }
        .grid-item strong { font-size: 15px; color: #f2f3f5; }
        .chat-container { background-color: #2b2d31; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .message { display: flex; margin-bottom: 20px; border-bottom: 1px solid #3f4147; padding-bottom: 15px; }
        .message:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; background-color: #5865f2; }
        .message-content { flex: 1; }
        .username { font-weight: bold; color: #f2f3f5; margin-right: 10px; }
        .timestamp { font-size: 12px; color: #949ba4; }
        .text { font-size: 15px; line-height: 1.5; word-break: break-word; }
        .attachment-img { max-width: 300px; max-height: 300px; border-radius: 8px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📑 Transcript ${ticketTypeLabel} #${ticket.ticketId}</h1>
        <div class="grid">
            <div class="grid-item"><span>Người tạo</span><strong>${creatorTag}</strong></div>
            <div class="grid-item"><span>Phân loại</span><strong>${ticketTypeLabel}</strong></div>
            <div class="grid-item"><span>Thời gian tạo</span><strong>${new Date(ticket.createdAt).toLocaleString('vi-VN')}</strong></div>
`;
        
        if (ticket.ticketType === 'WARRANTY') {
            htmlContent += `
            <div class="grid-item"><span>Sản phẩm</span><strong>${escapeHtml(ticket.productName || 'Không có')}</strong></div>
            <div class="grid-item"><span>Ngày mua</span><strong>${escapeHtml(ticket.purchaseDate || 'Không có')}</strong></div>
`;
        }

        htmlContent += `
        </div>
    </div>
    <div class="chat-container">
`;

        for (const msg of allMessages) {
            const time = new Date(msg.createdTimestamp).toLocaleString('vi-VN');
            const authorName = msg.author.tag;
            const avatarUrl = msg.author.displayAvatarURL({ extension: 'png', size: 64 }) || '';
            const textHtml = formatMarkdown(msg.content);

            htmlContent += `
        <div class="message">
            <img class="avatar" src="${avatarUrl}" alt="Avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="username">${authorName}</span>
                    <span class="timestamp">${time}</span>
                </div>
                <div class="text">${textHtml}</div>
`;
            if (msg.attachments.size > 0) {
                for (const [, att] of msg.attachments) {
                    if (att.contentType && att.contentType.startsWith('image/')) {
                        htmlContent += `<img src="${att.url}" class="attachment-img" alt="${att.name}">`;
                    } else {
                        htmlContent += `<div style="margin-top: 10px;"><a href="${att.url}" target="_blank" style="color: #3498db;">📎 ${att.name}</a></div>`;
                    }
                }
            }
            htmlContent += `
            </div>
        </div>
`;
        }

        htmlContent += `
    </div>
</body>
</html>
`;

        const buffer = Buffer.from(htmlContent, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticket.ticketId}.html` });

        // Gửi tóm tắt vào log
        if (summaryChannel) {
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(`📑 Transcript ${ticketTypeLabel} - #${ticket.ticketId}`)
                .addFields(
                    { name: 'Người tạo', value: `<@${ticket.creatorId}>`, inline: true },
                    { name: 'Phân loại', value: ticketTypeLabel, inline: true }
                )
                .setTimestamp();
            
            if (ticket.ticketType === 'WARRANTY') {
                embed.addFields(
                    { name: 'Sản phẩm', value: ticket.productName || 'N/A', inline: true },
                    { name: 'Ngày mua', value: ticket.purchaseDate || 'N/A', inline: true }
                );
            }

            await summaryChannel.send({ embeds: [embed] });
        }

        // Gửi file HTML
        if (htmlChannel) {
            await htmlChannel.send({
                content: `Lịch sử chat cho Ticket **#${ticket.ticketId}**`,
                files: [attachment]
            });
        }

        // Gửi vào DM của người tạo
        if (creator) {
            try {
                await creator.send({
                    content: `Cảm ơn bạn đã sử dụng dịch vụ. Đây là lịch sử chat của Ticket **#${ticket.ticketId}** (${ticketTypeLabel}).`,
                    files: [attachment]
                });
            } catch (err) {
                logger.warn(`[Ticket] Không thể gửi transcript DM cho user ${ticket.creatorId}: ${err.message}`);
            }
        }

        return true;
    } catch (error) {
        logger.error(`[Ticket] Lỗi tạo transcript: ${error.message}`);
        return false;
    }
}

module.exports = { createAndSendTicketTranscript };
