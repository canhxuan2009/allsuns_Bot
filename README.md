# 🤖 Discord VIP & Utility Bot

Bot Discord đa năng được phát triển bằng **Discord.js v14** (Node.js), cung cấp 3 tính năng cốt lõi:
1. **Hệ thống Quản lý Giao dịch & Cấp bậc VIP tự động** (cấp role theo tổng chi tiêu).
2. **Hệ thống Đếm tin nhắn & Tự động cập nhật tên kênh** (Auto Rename channel kèm tối ưu hóa rate limit).
3. **Hệ thống Tự động dịch thông báo DonutSMP (EN → VI)** sử dụng **Groq AI** (mượt mà, chuẩn ngữ cảnh game Minecraft).

---

## ✨ Các Tính Năng Chính

### 1. 💰 Quản lý Giao dịch & Phân cấp VIP
*   Tích lũy tổng tiền giao dịch của thành viên: cứ mỗi **100.000đ** tương đương với **1 cấp VIP** (tối đa VIP 10).
*   Tự động gán và gỡ các Role VIP tương ứng trên Discord khi cấp độ VIP thay đổi.
*   Tích hợp thanh tiến trình (progress bar) trực quan đến cấp VIP tiếp theo.

### 2. 📊 Đếm Tin Nhắn & Tự Động Đổi Tên Kênh (`/mescount`)
*   Theo dõi số lượng tin nhắn trong các kênh văn bản được chỉ định.
*   Tự động đổi tên kênh thành dạng: `<Tên kênh gốc> <Số tin nhắn>` (ví dụ: `💬-vouch-1250`).
*   **Tối ưu hóa Rate Limit & Tránh Spam API**:
    *   **Debounce 30 giây**: Gom nhiều tin nhắn liên tiếp để giảm số lần gọi API đổi tên.
    *   **Cooldown 10 phút**: Chờ tối thiểu 10 phút giữa mỗi lần cập nhật tên (tuân thủ giới hạn 2 lần đổi tên/10 phút của Discord) kèm cơ chế tự động lên lịch lại (re-schedule) nếu có cập nhật mới trong thời gian chờ.

### 3. 📝 Dịch Tự Động Thông Báo DonutSMP
*   Lắng nghe tin nhắn/embed từ kênh thông báo tiếng Anh của DonutSMP.
*   Dịch tự động sang tiếng Việt thông qua **Groq SDK** với model `llama-3.3-70b-versatile` (nhiệt độ `0.3` để bản dịch bám sát thực tế).
*   **System Prompt chuyên biệt cho game Minecraft**: Giữ nguyên các thuật ngữ game (như *Spawner, Netherite, Elytra, Rank VIP/MVP/King, lệnh game*) và chuyển ngữ chuẩn xác các thuật ngữ cộng đồng (*Wipe, Nerf, Buff, Crate/Key, Economy*).
*   Gửi kết quả dịch sang kênh chỉ định dưới dạng Embed đẹp mắt.

---

## 🛠️ Danh Sách Lệnh (Slash Commands)

| Lệnh | Mô tả | Quyền Hạn |
| :--- | :--- | :--- |
| `/add @user <amount> [note]` | Thêm số tiền giao dịch cho thành viên (cộng dồn và tự động nâng VIP/gán role). | **Manage Guild** (Quản lý máy chủ) hoặc **Bot Admin** |
| `/remove @user <amount> [note]` | Trừ số tiền giao dịch của thành viên (tự động hạ VIP/gỡ role nếu cần, không âm). | **Manage Guild** (Quản lý máy chủ) hoặc **Bot Admin** |
| `/profile [@user]` | Xem thông tin VIP, tổng giao dịch, tiến trình lên cấp tiếp theo và 5 giao dịch gần nhất. | **Mọi người** |
| `/leaderboard` | Bảng xếp hạng Top 10 thành viên có tổng giao dịch cao nhất. | **Mọi người** |
| `/reset @user <confirm>` | Reset toàn bộ lịch sử giao dịch và gỡ tất cả role VIP của thành viên đó. | **Administrator** (Quản trị viên) hoặc **Bot Admin** |
| `/mescount track <channel> <name>` | Đăng ký theo dõi và đếm tin nhắn cho kênh chỉ định với tiền tố tên gốc. | **Manage Channels** (Quản lý kênh) hoặc **Bot Admin** |
| `/mescount stop <channel>` | Dừng theo dõi và cập nhật tên tự động cho kênh. | **Manage Channels** (Quản lý kênh) hoặc **Bot Admin** |
| `/mescount list` | Xem danh sách các kênh đang được hệ thống đếm tin nhắn theo dõi. | **Mọi người** |

---

## 🏅 Hệ Thống VIP Mặc Định

| Cấp Độ VIP | Ngưỡng Giao Dịch | Emoji |
| :--- | :--- | :--- |
| **Thành viên** | 0đ - 99.999đ | 👤 |
| **VIP 1** | 100.000đ | ⭐ |
| **VIP 2** | 200.000đ | ⭐⭐ |
| **VIP 3** | 300.000đ | 🌟 |
| **VIP 4** | 400.000đ | 🌟🌟 |
| **VIP 5** | 500.000đ | 💎 |
| **VIP 6** | 600.000đ | 💎💎 |
| **VIP 7** | 700.000đ | 👑 |
| **VIP 8** | 800.000đ | 👑👑 |
| **VIP 9** | 900.000đ | 🏆 |
| **VIP 10** | 1.000.000đ+ | 🏆👑 |

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
DiscordBot/
├── src/
│   ├── index.js              # Điểm khởi đầu bot, lắng nghe sự kiện nhắn tin & dịch thuật
│   ├── deploy-commands.js    # Script đăng ký slash commands với Discord API
│   ├── commands/             # Thư mục định nghĩa các Slash Commands
│   │   ├── add.js            # Lệnh cộng tiền giao dịch
│   │   ├── remove.js         # Lệnh trừ tiền giao dịch
│   │   ├── profile.js        # Lệnh xem trang cá nhân thành viên
│   │   ├── leaderboard.js    # Bảng xếp hạng top 10
│   │   ├── reset.js          # Reset thông tin giao dịch & role VIP
│   │   └── mescount.js       # Quản lý tự động đếm tin nhắn và đổi tên kênh
│   └── utils/                # Thư mục chứa các module tiện ích bổ trợ
│       ├── autoRename.js     # Logic xử lý đổi tên kênh (debounce, cooldown)
│       ├── database.js       # Quản lý đọc/ghi cơ sở dữ liệu members.json
│       ├── logger.js         # Logger ghi chép nhật ký hệ thống ra console và file .log
│       ├── permissions.js    # Phân quyền thực thi lệnh (Discord Perms & Bot Admin)
│       ├── roles.js          # Logic gán/xóa role VIP của Discord Guild
│       ├── settings.js       # Phân tích cài đặt, vai trò quản trị viên & role mappings
│       ├── tracker.js        # Đọc/ghi cấu hình theo dõi kênh đếm tin nhắn tracker.json
│       └── translator.js     # Kết nối Groq SDK dịch tự động (EN -> VI)
├── data/                     # Thư mục lưu trữ dữ liệu JSON (được tự động tạo ra)
│   ├── members.json          # Lưu trữ lịch sử giao dịch và tổng tiền của thành viên
│   ├── settings.json         # Lưu cấu hình cũ (tương thích ngược)
│   └── tracker.json          # Lưu thông tin các kênh đang đếm tin nhắn
├── logs/                     # Thư mục lưu nhật ký hoạt động dưới dạng file .log theo phiên chạy
├── .env                      # File cấu hình biến môi trường và khóa bí mật
├── package.json              # Cấu hình dự án Node.js và quản lý dependency
└── README.md                 # Tài liệu hướng dẫn sử dụng dự án này
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Tạo Bot trên Discord Developer Portal
1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications).
2. Tạo mới một Application → Đặt tên và chọn **Create**.
3. Tại menu **Bot**:
    *   Tạo Token cho bot và sao chép lại.
    *   Bật các **Privileged Gateway Intents**:
        *   ✅ **Server Members Intent** (Để quản lý và gán role cho thành viên).
        *   ✅ **Message Content Intent** (Để bot đọc nội dung tin nhắn đếm số lượng & dịch thuật).
4. Tại menu **OAuth2** → Chọn **URL Generator**:
    *   **Scopes**: Chọn `bot` và `applications.commands`.
    *   **Bot Permissions**: Chọn `Manage Roles`, `Manage Channels`, `Send Messages`, `Embed Links`, `Read Message History`, `Use Application Commands`.
    *   Dùng link tạo ra để mời bot vào máy chủ của bạn.

### 2. Cài Đặt Mã Nguồn
Tải dự án về máy hoặc máy chủ hosting:
```bash
git clone https://github.com/CanhXuann/DiscordBot.git
cd DiscordBot
npm install
```

### 3. Cấu Hình File `.env`
Tạo file `.env` tại thư mục gốc của dự án với các thông số mẫu dưới đây:

```env
# ─── THÔNG TIN DISCORD BOT ───
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_bot_application_id_here
GUILD_ID=your_server_id_here

# ─── CẤU HÌNH DỊCH TỰ ĐỘNG DONUTSMP ───
GROQ_API_KEY=your_groq_api_key_here
TRANSLATE_SOURCE_CHANNEL=id_channel_tieng_anh_donut_smp
TRANSLATE_TARGET_CHANNEL=id_channel_nhan_ban_dich_tieng_viet

# ─── CẤU HÌNH BOT ADMIN ───
# Danh sách User ID của các quản trị viên bot (cách nhau bằng dấu phẩy)
BOT_ADMINS=1053646107785302069,963290585479938048

# ─── MAPPING CẤP ĐỘ VIP VỚI ROLE ID DISCORD ───
# Định dạng chuỗi JSON: {"cấp_vip": "role_id"}
VIP_ROLE_MAPPING={"1":"1516804867253997678","2":"1516804867253997678","3":"1516804867253997678","4":"1516804957159030956","5":"1516804957159030956","6":"1516804957159030956","7":"1516805957588488256","8":"1516805957588488256","9":"1516805957588488256","10":"1516805978828570745"}
```

> ⚠️ **Chú ý quan trọng về Role VIP**: Trong Discord, vị trí sắp xếp vai trò của Bot phải được kéo **nằm trên** tất cả các vai trò VIP có trong `VIP_ROLE_MAPPING` thì bot mới có thể gán hoặc gỡ role cho các thành viên khác thành công.

### 4. Đăng Ký Slash Commands
Đăng ký các lệnh slash `/add`, `/remove`, `/profile`, `/leaderboard`, `/reset`, `/mescount` với Discord API:
```bash
npm run deploy
```

### 5. Chạy Ứng Dụng
*   **Chế độ phát triển (Development - tự động khởi động lại khi sửa code):**
    ```bash
    npm run dev
    ```
*   **Chế độ vận hành (Production):**
    ```bash
    npm start
    ```

---

## 💾 Lưu Trữ & Quản Lý Dữ Liệu
Hệ thống sử dụng tệp JSON cục bộ trong thư mục `data/` để lưu trữ dữ liệu gọn nhẹ, không cần setup hệ quản trị cơ sở dữ liệu cồng kềnh:
*   `data/members.json`: Lưu trữ thông tin số tiền giao dịch và mảng lịch sử giao dịch chi tiết của từng thành viên.
*   `data/tracker.json`: Lưu danh sách các ID kênh và tiền tố tên gốc để duy trì việc đếm tin nhắn qua các phiên khởi động lại bot.
*   `logs/`: Lưu trữ file log theo mốc thời gian để dễ dàng debug hoạt động của bot.

---

## 🔧 Hướng Dẫn Mở Rộng Thêm Command Mới
Để phát triển thêm các lệnh Slash mới cho bot:
1. Tạo một tệp tin `.js` mới nằm trong thư mục `src/commands/`.
2. Định nghĩa cấu trúc lệnh theo chuẩn Discord.js v14:
   ```javascript
   const { SlashCommandBuilder } = require('discord.js');

   module.exports = {
       data: new SlashCommandBuilder()
           .setName('ten-lenh-moi')
           .setDescription('Mô tả tính năng lệnh mới'),

       async execute(interaction) {
           await interaction.reply('Kết quả trả về!');
       },
   };
   ```
3. Chạy lệnh đăng ký lại commands: `npm run deploy`. Bot sẽ tự động load lệnh mới ở lần chạy tiếp theo.
