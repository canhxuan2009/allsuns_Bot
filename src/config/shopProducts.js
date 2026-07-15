module.exports = [
    {
        id: 'gemini_advanced',
        label: 'Tài khoản Gemini',
        description: 'Dùng tài khoản của bạn / Acc shop cấp để thêm gói Google One và nhận 5TB',
        emoji: '<:Gemini:1526493944534401064>',
        image: 'https://cdn.discordapp.com/attachments/1524083621512613918/1525772148277514351/image.png?ex=6a57e54b&is=6a5693cb&hm=07084bdba688adf7df209e668486f7970abb1f7e182ce5ac4d0ae71fba929e07',
        variants: [
            { id: 'gemini_advanced_1m', label: '1 Tháng', price: 60000 },
            { id: 'atgrvt_18th', label: '18 Tháng', price: 120000, description: 'Chỉ dùng được hơn 10 tháng, KHÔNG BẢO HÀNH' }
        ]
    },
    {
        id: 'spotify_premium',
        label: 'Tài khoản Spotify Premium',
        description: 'Nghe nhạc không quảng cáo, chất lượng cao.',
        emoji: '<a:spotify_GG:1525861147968798721>',
        image: 'https://cdn.discordapp.com/attachments/1524083621512613918/1525882480824029325/so-sanh-diem-khac-biet-giua-spotify-free-va-premiu.png?ex=6a55004c&is=6a53aecc&hm=a0cc206fa6a813a378e76d7ac2fb04216cf4e70799cc53f466f11b3836044ac6&',
        variants: [
            { id: 'spotify_premium_1m', label: '1 Tháng', price: 30000 }
        ]
    },
    /*     {
            id: 'chatgpt_plus',
            label: 'Tài khoản ChatGPT Plus',
            description: 'Truy cập GPT-4, GPT-4o nhanh chóng.',
            emoji: '<:chat_gpt:1526500620490768488>',
            image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/ChatGPT_logo.svg/512px-ChatGPT_logo.svg.png',
            variants: [
                { id: 'chatgpt_plus_1m', label: '1 Tháng', price: 150000 }
            ]
        }, */
    {
        id: 'netflix_premium',
        label: 'Tài khoản Netflix Premium',
        description: 'Xem phim 4K HDR, sử dụng 1 profile riêng biệt.',
        emoji: '<a:LogoNetflix:1526499897610600478>',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Netflix_2015_N_logo.svg/512px-Netflix_2015_N_logo.svg.png',
        variants: [
            { id: 'netflix_premium_1m', label: '1 Tháng', price: 60000 }
        ]
    },
    {
        id: 'youtube_premium',
        label: 'Tài khoản Youtube Premium',
        description: 'Xem video không quảng cáo, chất lượng cao. (ADD FAMILY)',
        emoji: '<a:youtube_GG:1526493308606742569>',
        image: 'https://sadesign.vn/pictures/picfullsizes/2024/11/05/tcq1730778180.png',
        variants: [
            { id: 'yt_pre1m', label: '1 Tháng', price: 30000 },
            { id: 'yt_pre3m', label: '3 Tháng', price: 80000 }
        ]
    },
    {
        id: 'elodorado',
        label: 'Tài khoản Elodorado verified',
        description: 'Tài khoản sàn Elodorado verified, mua về BÁN luôn',
        emoji: '<:elodorado:1526846586511163543>',
        image: 'https://cdn.discordapp.com/attachments/1524083621512613918/1526847911827341372/image.png?ex=6a58836d&is=6a5731ed&hm=31b4b5d817cd32d57f24b830d50b2f1a82bc31f133fb19e923141c27c0afcbd2',
        variants: [
            { id: 'Elodorado_Verified', label: 'Elo verified', price: 1500000 },
        ]
    },
    {
        id: 'xbox',
        label: 'Nâng cấp tài khoản Xbox',
        description: 'Kích hoạt/Nâng cấp Xbox Game Pass Ultimate chính chủ, chiến mọi tựa game PC và Console.',
        emoji: '<a:xbox:1526846777100079194>',
        image: 'https://cdn.discordapp.com/attachments/1524083621512613918/1526849613078990848/image.png?ex=6a588503&is=6a573383&hm=e5049d95ac024e945c45f1cf5511b735b67858b7db1dcdb0961ca8e8c63fac13',
        variants: [
            { id: 'pc-gamepass', label: 'PC Gamepass 1 tháng', price: 100000, description: 'Chơi miễn phí Hơn 100 game PC chất lượng cao (không hỗ trợ Cloud Gaming)' },
            { id: 'gamepass-essential', label: 'Gamepass Essential 1 tháng', price: 300000, description: 'Hỗ trợ Cloud Gaming cho khoảng 25 game cosole' },
            { id: 'gamepass-ultimate', label: 'Gamepass Ultimate 1 tháng', price: 600000, description: 'Gồm cả PC Game Pass, Game Pass trên Console, EA Play và Cloud Gaming' }
        ]
    },
];
