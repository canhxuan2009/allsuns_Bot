require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const logger = require('./utils/logger');
const { init: initAutoRename, scheduleRename } = require('./utils/autoRename');
const { getTracked } = require('./utils/tracker');
const { translateToVietnamese } = require('./utils/translator');

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

    const tracked = getTracked(message.guild.id, message.channel.id);
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
client.on(Events.MessageDelete, (message) => {
    if (!message.guild) return;
    if (message.author?.bot) return;
    const tracked = getTracked(message.guild.id, message.channel.id);
    if (!tracked) return;
    scheduleRename(message.guild.id, message.channel.id);
});

// Lắng nghe xóa tin nhắn hàng loạt
client.on(Events.MessageBulkDelete, (messages) => {
    const first = messages.first();
    if (!first?.guild) return;
    const tracked = getTracked(first.guild.id, first.channel.id);
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

// ─── Chatbot Gemini tự động (Google AI Studio) ─────────────────────────
const GEMINI_CHANNEL_ID = process.env.GEMINI_CHANNEL_ID;
const { chatWithGemini } = require('./utils/geminiChat');

client.on(Events.MessageCreate, async (message) => {
    // Bỏ qua nếu chưa cấu hình channel hoặc tin nhắn không thuộc channel chỉ định
    if (!GEMINI_CHANNEL_ID || message.channel.id !== GEMINI_CHANNEL_ID) return;

    // Bỏ qua tin nhắn của bot (bao gồm cả chính nó và bot khác)
    if (message.author.bot) return;

    try {
        // Kích hoạt trạng thái đang gõ (typing indicator)
        await message.channel.sendTyping();

        // Lấy 15 tin nhắn gần nhất để làm ngữ cảnh hội thoại
        const fetched = await message.channel.messages.fetch({ limit: 15 });
        const history = Array.from(fetched.values()).reverse();

        const contents = [];
        for (const msg of history) {
            // Bỏ qua tin nhắn trống (ví dụ tin nhắn hệ thống hoặc chỉ có attachment không đọc được)
            if (!msg.content && msg.embeds.length === 0) continue;

            const isBot = msg.author.id === client.user.id;
            const role = isBot ? 'model' : 'user';

            let text = msg.content;
            if (!text && msg.embeds.length > 0) {
                const embed = msg.embeds[0];
                text = [embed.title, embed.description].filter(Boolean).join('\n\n');
            }

            // Gắn tên user vào trước tin nhắn của user để Gemini biết ai đang nói chuyện
            const formattedText = !isBot 
                ? `[${msg.author.displayName ?? msg.author.username}]: ${text}`
                : text;

            const lastContent = contents[contents.length - 1];
            if (lastContent && lastContent.role === role) {
                // Nhóm các tin nhắn liên tiếp của cùng 1 role
                lastContent.parts[0].text += `\n${formattedText}`;
            } else {
                contents.push({
                    role: role,
                    parts: [{ text: formattedText }]
                });
            }
        }

        // Đảm bảo lượt đầu tiên bắt đầu bằng 'user' (quy định của Gemini API)
        while (contents.length > 0 && contents[0].role !== 'user') {
            contents.shift();
        }

        if (contents.length === 0) {
            return;
        }

        // Gọi Gemini API
        const replyText = await chatWithGemini(contents);

        if (!replyText) {
            await message.reply({ content: '❌ Xin lỗi, mình gặp lỗi khi kết nối với bộ não Gemini. Vui lòng thử lại sau!' });
            return;
        }

        // Chia nhỏ tin nhắn nếu dài hơn 2000 ký tự (giới hạn của Discord)
        let text = replyText;
        const chunks = [];
        
        while (text.length > 0) {
            if (text.length <= 2000) {
                chunks.push(text);
                break;
            }
            let chunk = text.substring(0, 2000);
            let splitIdx = chunk.lastIndexOf('\n');
            if (splitIdx === -1 || splitIdx < 1500) {
                splitIdx = chunk.lastIndexOf(' ');
            }
            if (splitIdx === -1 || splitIdx < 1500) {
                splitIdx = 2000;
            }
            chunks.push(text.substring(0, splitIdx));
            text = text.substring(splitIdx).trim();
        }

        // Gửi từng phần phản hồi
        for (const chunk of chunks) {
            if (chunk.length > 0) {
                await message.reply({ content: chunk });
            }
        }

    } catch (error) {
        logger.error(`[Gemini Chatbot] Lỗi xử lý tin nhắn: ${error.message}`);
    }
});

// Bot ready
client.once(Events.ClientReady, (readyClient) => {
    logger.info('━'.repeat(50));
    logger.info(`Bot đã online: ${readyClient.user.tag}`);
    logger.info(`Đang phục vụ ${readyClient.guilds.cache.size} server(s)`);
    logger.info(`${client.commands.size} command(s) đã load`);
    logger.info(`File log: ${logger.currentFile}`);
    logger.info('━'.repeat(50));
});

// Đăng nhập
client.login(process.env.DISCORD_TOKEN);
