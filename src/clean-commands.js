require('dotenv').config();
const { REST, Routes } = require('discord.js');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong file .env');
    process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Bắt đầu xoá toàn bộ Slash Commands cũ để dọn dẹp...');

        // 1. Xoá tất cả lệnh Global
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] }
        );
        console.log('✅ Đã xoá sạch lệnh Global.');

        // 2. Xoá tất cả lệnh trong Server (Guild)
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: [] }
            );
            console.log(`✅ Đã xoá sạch lệnh trong Server (Guild ID: ${process.env.GUILD_ID}).`);
        }

        console.log('\n🎉 Dọn dẹp hoàn tất! Bây giờ bạn hãy chạy lệnh sau để đăng ký lại bộ lệnh mới nhất:');
        console.log('👉 node src/deploy-commands.js');

    } catch (error) {
        console.error('❌ Gặp lỗi khi dọn dẹp lệnh:', error);
    }
})();
