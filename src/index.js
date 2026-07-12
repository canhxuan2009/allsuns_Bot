require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const logger = require('./utils/logger');
const { init: initAutoRename, scheduleRename } = require('./utils/autoRename');
const { getTracked } = require('./utils/tracker');
const { translateToVietnamese } = require('./utils/translator');
const { handleEscrowInteraction } = require('./utils/escrowInteractions');
const { handleShopInteraction } = require('./utils/shopInteractions');

// ─── Cấu hình dịch tự động DonutSMP ────────────────────────────────────
// Channel nguồn: nơi chứa thông báo tiếng Anh từ DonutSMP
// Channel đích: nơi bot gửi bản dịch tiếng Việt
const TRANSLATE_SOURCE = process.env.TRANSLATE_SOURCE_CHANNEL;
const TRANSLATE_TARGET = process.env.TRANSLATE_TARGET_CHANNEL;
const TRANSLATE_PING_ROLE_ID = process.env.TRANSLATE_PING_ROLE_ID;

// Kiểm tra token trước khi khởi động
if (!process.env.DISCORD_TOKEN) {
    logger.error('FATAL: Biến môi trường DISCORD_TOKEN chưa được cấu hình!');
    logger.error('Trên Pterodactyl: Startup tab → Variables → thêm DISCORD_TOKEN');
    process.exit(1);
}

// Kiểm tra MongoDB URI
if (!process.env.MONGODB_URI) {
    logger.error('FATAL: Biến môi trường MONGODB_URI chưa được cấu hình!');
    logger.error('Vui lòng thêm MONGODB_URI=mongodb+srv://... vào file .env');
    process.exit(1);
}

// Global error handlers — ngăn bot tắt ngầm khi có lỗi không được xử lý
process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error}`);
});

// Khởi tạo client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages, // Cần cho chức năng đếm tin nhắn tự động
        GatewayIntentBits.MessageContent, // Bắt buộc phải có để đọc nội dung tin nhắn chat
    ],
});

// Khởi tạo module tự động đổi tên kênh
initAutoRename(client);

// Collection chứa tất cả commands
client.commands = new Collection();

// Tự động load commands từ thư mục commands/
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: /${command.data.name}`);
    } else {
        logger.warn(`Command ${file} thiếu "data" hoặc "execute".`);
    }
}

// Xử lý slash commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        logger.warn(`Không tìm thấy command: ${interaction.commandName}`);
        return;
    }

    // Ghi log lệnh người dùng thực thi
    logger.logCommand(interaction);

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Lỗi khi chạy /${interaction.commandName}: ${error}`);
        const reply = {
            content: '❌ Đã xảy ra lỗi khi thực hiện lệnh này!',
            ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

// Xử lý Button, Modal & SelectMenu interactions (Escrow & Shop Ticket System)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    try {
        let handled = await handleEscrowInteraction(interaction);
        if (handled) return;
        
        handled = await handleShopInteraction(interaction);
        if (handled) return;
    } catch (error) {
        logger.error(`[Escrow] Lỗi xử lý interaction: ${error.message}`);
        const reply = { content: '❌ Đã xảy ra lỗi khi xử lý yêu cầu.', ephemeral: true };
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch { /* ignore */ }
    }
});

/**
 * Kiểm tra cú pháp tin nhắn bằng cách duyệt xâu truyền thống:
 * Phải bắt đầu bằng "+" -> "1" -> "vouch" hoặc "legit" (chấp nhận mọi kiểu khoảng trắng ở giữa) và bắt buộc có lời nhắn phía sau.
 * @param {string} text 
 * @returns {boolean}
 */
function isValidVouch(text) {
    if (!text) return false;

    const cleaned = text.trim().toLowerCase();

    // 1. Phải bắt đầu bằng ký tự '+'
    if (!cleaned.startsWith('+')) return false;

    // Bỏ '+' và cắt khoảng trắng đầu cuối
    let rest = cleaned.substring(1).trim();

    // 2. Tiếp theo phải bắt đầu bằng số '1'
    if (!rest.startsWith('1')) return false;

    // Bỏ '1' và cắt khoảng trắng đầu cuối
    rest = rest.substring(1).trim();

    // 3. Tiếp theo phải là 'vouch' hoặc 'legit'
    let keyword = '';
    if (rest.startsWith('vouch')) {
        keyword = 'vouch';
    } else if (rest.startsWith('legit')) {
        keyword = 'legit';
    } else {
        return false; // Không khớp từ khóa nào
    }

    // Bỏ từ khóa và lấy phần lời nhắn phía sau
    const messagePart = rest.substring(keyword.length).trim();

    // 4. Bắt buộc phải có lời nhắn phía sau (độ dài > 0)
    return messagePart.length > 0;
}

// Lắng nghe tin nhắn mới — kiểm tra cú pháp + đếm tin nhắn
client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const tracked = await getTracked(message.guild.id, message.channel.id);
    if (!tracked) return;

    // Kiểm tra cú pháp trong kênh đang theo dõi
    const isValid = isValidVouch(message.content);
    logger.info(`[FormatCheck] Thử nghiệm tin nhắn: "${message.content}" | Kết quả kiểm tra: ${isValid}`);

    if (!isValid) {
        try {
            await message.delete();

            const warning = await message.channel.send(
                `${message.author} 💬 Ôi, tin nhắn của bạn chưa đúng cú pháp rồi!\n` +
                `Bạn vui lòng gửi lại theo mẫu nhé:\n` +
                `> ✅ \`+1 vouch ...\` hoặc \`+1 legit ...\`\n` +
                `Cảm ơn bạn rất nhiều! 🙏✨`
            );

            // Tự xóa cảnh báo sau 10 giây — không ảnh hưởng đến đếm tin nhắn
            setTimeout(() => warning.delete().catch(() => { }), 10_000);
        } catch (err) {
            logger.error(`[FormatCheck] Lỗi xử lý tin nhắn sai: ${err.message}`);
        }
        return; // Tin nhắn sai — không đếm, không cập nhật tên kênh
    }

    // Tin nhắn hợp lệ — lên lịch cập nhật tên kênh
    scheduleRename(message.guild.id, message.channel.id);
});

// Lắng nghe tin nhắn bị xóa đơn lẻ (bỏ qua tin nhắn bot — cảnh báo tự xóa)
client.on(Events.MessageDelete, async (message) => {
    if (!message.guild) return;
    if (message.author?.bot) return;
    const tracked = await getTracked(message.guild.id, message.channel.id);
    if (!tracked) return;
    scheduleRename(message.guild.id, message.channel.id);
});

// Lắng nghe xóa tin nhắn hàng loạt
client.on(Events.MessageBulkDelete, async (messages) => {
    const first = messages.first();
    if (!first?.guild) return;
    const tracked = await getTracked(first.guild.id, first.channel.id);
    if (!tracked) return;
    scheduleRename(first.guild.id, first.channel.id);
});

// ─── Dịch tự động thông báo DonutSMP (EN → VI) ─────────────────────────
// Listener riêng biệt — chỉ xử lý tin nhắn từ channel nguồn đã cấu hình.
// Không ảnh hưởng đến logic vouch/mescount ở trên.
client.on(Events.MessageCreate, async (message) => {
    // Bỏ qua nếu chưa cấu hình channel dịch
    if (!TRANSLATE_SOURCE || !TRANSLATE_TARGET) return;

    // Chỉ xử lý tin nhắn trong channel nguồn
    if (message.channel.id !== TRANSLATE_SOURCE) return;

    // Bỏ qua tin nhắn của chính bot này (tránh vòng lặp vô hạn)
    if (message.author.id === message.client.user.id) return;

    // Lấy nội dung — ưu tiên content, nếu rỗng thì lấy từ embed đầu tiên
    let content = message.content;
    if (!content && message.embeds.length > 0) {
        // Nhiều bot/webhook gửi thông báo dưới dạng embed
        const embed = message.embeds[0];
        content = [embed.title, embed.description].filter(Boolean).join('\n\n');
    }

    // Không có gì để dịch
    if (!content || content.trim().length === 0) return;

    logger.info(`[Translator] Nhận tin nhắn từ #${message.channel.name}: "${content.substring(0, 80)}..."`);

    try {
        // Gọi Gemini API để dịch
        const translated = await translateToVietnamese(content);
        if (!translated) {
            logger.warn('[Translator] Không nhận được bản dịch, bỏ qua.');
            return;
        }

        // Lấy channel đích để gửi bản dịch
        const targetChannel = await message.client.channels.fetch(TRANSLATE_TARGET);
        if (!targetChannel) {
            logger.error(`[Translator] Không tìm thấy channel đích: ${TRANSLATE_TARGET}`);
            return;
        }

        // Discord giới hạn nội dung tin nhắn thường tối đa 2000 ký tự.
        // Chuẩn bị phần đầu (tiêu đề và ping role nếu cấu hình)
        const pingText = (TRANSLATE_PING_ROLE_ID && TRANSLATE_PING_ROLE_ID.trim())
            ? `<@&${TRANSLATE_PING_ROLE_ID.trim()}>`
            : '';
        const authorName = message.author.displayName ?? message.author.username;
        const headerText = `📝 **Bản dịch thông báo DonutSMP** (Nguồn: **${authorName}**)\n\n`;
        const prefix = pingText ? `${pingText} ${headerText}` : headerText;

        const MAX_MESSAGE_LIMIT = 2000;
        const availableLength = MAX_MESSAGE_LIMIT - prefix.length;
        const truncated = translated.length > availableLength
            ? translated.substring(0, availableLength - 3) + '...'
            : translated;

        const finalMessage = `${prefix}${truncated}`;

        await targetChannel.send({ content: finalMessage });
        logger.info(`[Translator] ✅ Đã gửi bản dịch vào #${targetChannel.name}`);

    } catch (error) {
        logger.error(`[Translator] ❌ Lỗi xử lý dịch tự động: ${error.message}`);
    }
});

// ─── Kiểm duyệt hình ảnh tự động bằng AI (Gemini Vision) ──────────────
const MODERATION_MEMBER_ROLE_ID = process.env.MODERATION_MEMBER_ROLE_ID;
const MODERATION_OWNER_ID = process.env.MODERATION_OWNER_ID;
const MODERATION_MUTE_MINUTES = parseInt(process.env.MODERATION_MUTE_MINUTES) || 60;
const { analyzeImage } = require('./utils/imageModeration');

// Danh sách các MIME type ảnh được hỗ trợ
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Danh sách user đã bị phát hiện scam — tự động xoá tin nhắn tiếp theo mà không cần gọi API
// Lưu theo guildId:userId để tránh xung đột giữa các server
const flaggedScamUsers = new Set();

// Map lưu thời gian quét ảnh gần nhất của mỗi user để làm cooldown (10 phút)
const imageModerationCooldowns = new Map();
const MODERATION_COOLDOWN_MS = 10 * 60 * 1000; // 10 phút

client.on(Events.MessageCreate, async (message) => {
    // Bỏ qua nếu chưa cấu hình hoặc không phải tin nhắn trong server
    if (!MODERATION_MEMBER_ROLE_ID || !message.guild || message.author.bot) return;

    // Kiểm tra người gửi có role Member hay không
    const member = message.member;
    if (!member || !member.roles.cache.has(MODERATION_MEMBER_ROLE_ID)) return;

    // ── Kiểm tra user đã bị gắn cờ scam ─────────────────────────────
    // Nếu user đã bị phát hiện scam trước đó → xoá tin nhắn ngay, không cần gọi API
    const flagKey = `${message.guild.id}:${message.author.id}`;
    if (flaggedScamUsers.has(flagKey)) {
        try {
            await message.delete();
            logger.info(`[ImageMod] 🗑️ Đã xoá tin nhắn của user bị gắn cờ scam: ${message.author.tag}`);
        } catch (err) {
            logger.error(`[ImageMod] Không thể xoá tin nhắn của user gắn cờ: ${err.message}`);
        }
        return;
    }

    // Kiểm tra tin nhắn có chứa attachment ảnh hay không
    const imageAttachments = message.attachments.filter(
        att => att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.split(';')[0])
    );
    if (imageAttachments.size === 0) return;

    // ── Kiểm tra Cooldown 10 phút ──────────────────────────────────
    const cooldownKey = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const lastScan = imageModerationCooldowns.get(cooldownKey);
    if (lastScan && now - lastScan < MODERATION_COOLDOWN_MS) {
        const remaining = Math.ceil((MODERATION_COOLDOWN_MS - (now - lastScan)) / 1000);
        logger.info(`[ImageMod] Bỏ qua quét ảnh từ ${message.author.tag} (cooldown còn ${remaining} giây)`);
        return;
    }

    // Thiết lập Cooldown và tự động xoá khỏi Map khi hết hạn
    imageModerationCooldowns.set(cooldownKey, now);
    setTimeout(() => {
        if (imageModerationCooldowns.get(cooldownKey) === now) {
            imageModerationCooldowns.delete(cooldownKey);
        }
    }, MODERATION_COOLDOWN_MS);

    // Phân tích từng ảnh
    for (const [, attachment] of imageAttachments) {
        try {
            logger.info(`[ImageMod] Đang phân tích ảnh từ ${message.author.tag}: ${attachment.url}`);

            const result = await analyzeImage(attachment.url);
            if (!result) continue; // Lỗi API hoặc không parse được → bỏ qua

            // ── Xử lý SCAM ──────────────────────────────────────────
            if (result.category === 'SCAM') {
                logger.warn(`[ImageMod] 🚨 SCAM detected! User: ${message.author.tag} | Reason: ${result.reason}`);

                // Gắn cờ user → mọi tin nhắn tiếp theo sẽ bị xoá tự động trong vòng 1 phút
                flaggedScamUsers.add(flagKey);
                setTimeout(() => {
                    flaggedScamUsers.delete(flagKey);
                    logger.info(`[ImageMod] 🔓 Đã gỡ bỏ cờ scam cho user: ${message.author.tag}`);
                }, 60_000);

                // 1. Xoá tin nhắn
                try {
                    await message.delete();
                } catch (delErr) {
                    logger.error(`[ImageMod] Không thể xoá tin nhắn: ${delErr.message}`);
                }

                // 2. Mute (timeout) người gửi
                try {
                    const muteDuration = MODERATION_MUTE_MINUTES * 60 * 1000; // Chuyển sang milliseconds
                    await member.timeout(muteDuration, `[AutoMod] Phát hiện ảnh lừa đảo: ${result.reason}`);
                    logger.info(`[ImageMod] ✅ Đã mute ${message.author.tag} trong ${MODERATION_MUTE_MINUTES} phút.`);
                } catch (muteErr) {
                    logger.error(`[ImageMod] Không thể mute ${message.author.tag}: ${muteErr.message}`);
                }

                // 3. Gửi cảnh báo trong kênh
                try {
                    const warning = await message.channel.send(
                        `🚨 ${message.author} đã bị phát hiện gửi **nội dung lừa đảo** và đã bị mute.\n` +
                        `Nếu có sai sót, vui lòng nhắn tin trực tiếp (DM) cho Admin để được hỗ trợ. 📩`
                    );
                    // Tự xoá cảnh báo sau 15 giây
                    setTimeout(() => warning.delete().catch(() => {}), 15_000);
                } catch (warnErr) {
                    logger.error(`[ImageMod] Không thể gửi cảnh báo trong kênh: ${warnErr.message}`);
                }

                // Nội dung thông báo chi tiết (dùng chung cho cả owner và người vi phạm)
                const violationInfo =
                    `🚨 **Phát hiện ảnh lừa đảo (SCAM)**\n\n` +
                    `👤 **Người gửi:** ${message.author.tag} (${message.author.id})\n` +
                    `📍 **Kênh:** #${message.channel.name} (${message.channel.id})\n` +
                    `🏠 **Server:** ${message.guild.name}\n` +
                    `📝 **Lý do:** ${result.reason}\n` +
                    `⏱️ **Đã mute:** ${MODERATION_MUTE_MINUTES} phút\n` +
                    `🕐 **Thời gian:** ${new Date().toLocaleString('vi-VN')}`;

                // 4. DM cho chủ bot kèm ảnh vi phạm
                if (MODERATION_OWNER_ID) {
                    try {
                        const owner = await message.client.users.fetch(MODERATION_OWNER_ID);
                        await owner.send({
                            content: violationInfo,
                            files: [{ attachment: attachment.url, name: attachment.name || 'scam_image.png' }]
                        });
                        logger.info(`[ImageMod] ✅ Đã gửi DM thông báo cho owner.`);
                    } catch (dmErr) {
                        logger.error(`[ImageMod] Không thể gửi DM cho owner: ${dmErr.message}`);
                    }
                }

                // 5. DM cho người vi phạm kèm ảnh
                try {
                    await message.author.send({
                        content:
                            violationInfo + `\n\n` +
                            `📩 Nếu bạn cho rằng đây là nhầm lẫn, vui lòng nhắn tin trực tiếp cho Admin của server để được hỗ trợ giải quyết.`,
                        files: [{ attachment: attachment.url, name: attachment.name || 'scam_image.png' }]
                    });
                    logger.info(`[ImageMod] ✅ Đã gửi DM thông báo cho người vi phạm: ${message.author.tag}`);
                } catch (dmErr) {
                    logger.error(`[ImageMod] Không thể gửi DM cho người vi phạm (có thể đã tắt DM): ${dmErr.message}`);
                }

                break; // Đã xoá tin nhắn, không cần kiểm tra các ảnh còn lại
            }

            // ── Xử lý NSFW ──────────────────────────────────────────
            if (result.category === 'NSFW') {
                logger.warn(`[ImageMod] 🔞 NSFW detected! User: ${message.author.tag} | Reason: ${result.reason}`);

                // 1. Xoá tin nhắn
                try {
                    await message.delete();
                } catch (delErr) {
                    logger.error(`[ImageMod] Không thể xoá tin nhắn: ${delErr.message}`);
                }

                // 2. Ping cảnh báo trong kênh
                try {
                    const warning = await message.channel.send(
                        `⚠️ ${message.author} Bạn đã gửi ảnh có nội dung nhạy cảm (NSFW).\n` +
                        `Hành vi này vi phạm quy tắc server. Vui lòng không lặp lại! 🚫`
                    );
                    // Tự xoá cảnh báo sau 10 giây
                    setTimeout(() => warning.delete().catch(() => {}), 10_000);
                } catch (warnErr) {
                    logger.error(`[ImageMod] Không thể gửi cảnh báo: ${warnErr.message}`);
                }

                break; // Đã xoá tin nhắn, không cần kiểm tra các ảnh còn lại
            }

            // SAFE → không làm gì

        } catch (error) {
            logger.error(`[ImageMod] Lỗi xử lý ảnh: ${error.message}`);
        }
    }
});

// Bot ready & Tự động đồng bộ Slash Commands
client.once(Events.ClientReady, async (readyClient) => {
    logger.info('━'.repeat(50));
    logger.info(`Bot đã online: ${readyClient.user.tag}`);
    logger.info(`Đang phục vụ ${readyClient.guilds.cache.size} server(s)`);
    logger.info(`${client.commands.size} command(s) đã load`);
    logger.info(`File log: ${logger.currentFile}`);
    logger.info('━'.repeat(50));

    // Tự động dọn dẹp và đồng bộ lại Slash Commands lên Discord
    try {
        const { REST, Routes } = require('discord.js');
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        
        // Chuẩn bị danh sách lệnh hiện tại
        const commands = [];
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command) {
                commands.push(command.data.toJSON());
            }
        }

        logger.info(`[SlashCommands] Đang đồng bộ và dọn dẹp lệnh...`);

        // 1. Xoá sạch các lệnh Global cũ (tránh trùng lặp và lệnh rác)
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: [] }
        );

        // 2. Đăng ký lại danh sách lệnh mới nhất
        if (process.env.GUILD_ID) {
            // Chế độ Dev / Server riêng (cập nhật ngay lập tức)
            await rest.put(
                Routes.applicationGuildCommands(readyClient.user.id, process.env.GUILD_ID),
                { body: commands }
            );
            logger.info(`[SlashCommands] ✅ Đã xoá sạch lệnh cũ và đăng ký mới ${commands.length} lệnh cho Server ${process.env.GUILD_ID}`);
        } else {
            // Chế độ Global (cập nhật toàn hệ thống)
            await rest.put(
                Routes.applicationCommands(readyClient.user.id),
                { body: commands }
            );
            logger.info(`[SlashCommands] ✅ Đã xoá sạch lệnh cũ và đăng ký mới ${commands.length} lệnh Globally`);
        }
    } catch (err) {
        logger.error(`[SlashCommands] Lỗi tự động đồng bộ lệnh: ${err.message}`);
    }
});

// ─── Tự động nhắc nhở gõ /panel sau mỗi 15 tin nhắn trong kênh Ticket ───
const escrowMessageCounters = new Map();

client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    // Bỏ qua nếu kênh không nằm trong category giao dịch trung gian
    const escrowCategoryId = process.env.ESCROW_CATEGORY_ID;
    if (!escrowCategoryId || message.channel.parentId !== escrowCategoryId) return;

    try {
        let count = escrowMessageCounters.get(message.channel.id) || 0;
        count++;

        if (count >= 15) {
            // Xoá tin mẹo cũ của bot trong kênh (quét 50 tin gần nhất)
            const messages = await message.channel.messages.fetch({ limit: 50 });
            const oldTip = messages.find(m => 
                m.author.id === message.client.user.id && 
                m.content.includes('gõ lệnh `/panel` để kéo nó xuống')
            );
            if (oldTip) {
                await oldTip.delete().catch(() => {});
            }

            // Gửi tin mẹo mới xuống cuối
            await message.channel.send(`💡 **Mẹo:** Trong lúc trò chuyện, nếu bảng điều khiển ở trên bị tin nhắn chat làm trôi đi, bạn hãy gõ lệnh \`/panel\` để kéo nó xuống dưới cùng nhé!`);
            
            // Reset bộ đếm
            escrowMessageCounters.set(message.channel.id, 0);
        } else {
            escrowMessageCounters.set(message.channel.id, count);
        }
    } catch (err) {
        logger.error(`[Escrow-Tip] Lỗi khi đếm tin nhắn và gửi gợi ý: ${err.message}`);
    }
});

// ─── Kết nối MongoDB rồi đăng nhập Discord ─────────────────────────────
async function start() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Đã kết nối MongoDB Atlas thành công!');
    } catch (error) {
        logger.error(`❌ Không thể kết nối MongoDB: ${error.message}`);
        process.exit(1);
    }

    // Đăng nhập Discord sau khi kết nối DB thành công
    client.login(process.env.DISCORD_TOKEN);
}

start();
