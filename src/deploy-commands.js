require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`📦 Đăng ký command: /${command.data.name}`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n🔄 Đang đăng ký ${commands.length} slash command(s)...`);

        // Deploy theo guild (nhanh, dùng khi dev)
        if (process.env.GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`✅ Đã đăng ký ${data.length} command(s) cho guild ${process.env.GUILD_ID}`);
        } else {
            // Deploy global (mất ~1 giờ để cập nhật)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ Đã đăng ký ${data.length} command(s) globally`);
        }
    } catch (error) {
        console.error('❌ Lỗi đăng ký commands:', error);
    }
})();
