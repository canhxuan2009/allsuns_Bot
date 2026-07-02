/**
 * translator.js — Module dịch tự động thông báo DonutSMP (EN → VI)
 * 
 * Sử dụng Groq API để dịch nội dung tiếng Anh sang tiếng Việt chuẩn ngữ cảnh Minecraft.
 * Dùng model llama-3.3-70b-versatile cho chất lượng dịch tốt nhất.
 * 
 * Cách hoạt động:
 * 1. Nhận nội dung tin nhắn tiếng Anh
 * 2. Gửi đến Groq API kèm System Prompt chuyên biệt
 * 3. Trả về bản dịch tiếng Việt
 */

const Groq = require('groq-sdk');
const logger = require('./logger');

// ─── System Prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `nhiệm vụ của bạn là dịch thông báo cập nhật (Update changelogs) của server minecraft DonutSMP từ tiếng Anh sang tiếng Việt. Hãy tuân thủ nghiêm ngặt các quy tắc sau khi dịch
1.ĐÚNG NGỮ CẢNH: dịch các cập nhật của máy chủ sao cho đúng ngữ cảnh, đúng nội dung nhưng tuyệt đối không được cứng ngắc như google dịch
2.XỬ LÍ THUẬT NGỮ:
- tuyệt đối giữ nguyên với những từ đặc biệt: tên các loại farm (cobblestone farm, kelp farm, basalt farm, ...), tên các vật phẩm đã quá quen dùng tiếng anh(spawner, amethyst pickaxe, ender pearl, chunk,...), lệnh game, tên riêng.
- giữ nguyên các từ tiếng anh không có nghĩa tiếng việt hoặc có nghĩa nhưng không phù hợp với môi trường minecraft
- giữ nguyên các thuật ngữ gamer cơ bản: buff, nerf, spawn, ...
3.GIỮ NGUYÊN ĐỊNH DẠNG: Bắt buộc giữ nguyên các ký hiệu định dạng Discord (**bold**, *italic*, v.v.) và các Emoji (🎃, ⚔️) y hệt bản gốc.
CHỈ TRẢ VỀ BẢN DỊCH TIẾNG VIỆT, KHÔNG THÊM BẤT KỲ LỜI GIẢI THÍCH HAY BÌNH LUẬN NÀO.`;

// ─── Khởi tạo Groq Client ──────────────────────────────────────────────
let groqInstance = null;

/**
 * Khởi tạo (hoặc lấy lại) instance Groq.
 * @returns {Groq} Instance Groq đã cấu hình
 */
function getGroqClient() {
    if (groqInstance) return groqInstance;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY chưa được cấu hình trong file .env!');
    }

    groqInstance = new Groq({ apiKey });
    logger.info('[Translator] Đã khởi tạo Groq client thành công.');
    return groqInstance;
}

// ─── Hàm dịch chính ────────────────────────────────────────────────────

/**
 * Dịch nội dung tiếng Anh sang tiếng Việt bằng Groq API.
 * 
 * @param {string} englishText - Nội dung tiếng Anh cần dịch
 * @returns {Promise<string|null>} Bản dịch tiếng Việt, hoặc null nếu lỗi
 */
async function translateToVietnamese(englishText) {
    if (!englishText || englishText.trim().length === 0) {
        logger.warn('[Translator] Nội dung rỗng, bỏ qua.');
        return null;
    }

    try {
        const groq = getGroqClient();

        // Gọi API Chat Completions của Groq
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: englishText,
                }
            ],
            // Model llama-3.3-70b-versatile dịch rất chuẩn, văn phong mượt mà
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3, // Thấp để đảm bảo bám sát chỉ dẫn dịch thuật
        });

        const translatedText = chatCompletion.choices[0]?.message?.content;

        if (!translatedText || translatedText.trim().length === 0) {
            logger.warn('[Translator] Groq trả về kết quả rỗng.');
            return null;
        }

        logger.info(`[Translator] Dịch thành công via Groq (${englishText.length} → ${translatedText.length} ký tự)`);
        return translatedText.trim();

    } catch (error) {
        // Bắt và log chi tiết các lỗi có thể xảy ra
        if (error.status === 401) {
            logger.error('[Translator] ❌ GROQ_API_KEY không hợp lệ! Hãy kiểm tra lại file .env');
        } else if (error.status === 429) {
            logger.error('[Translator] ⚠️ Quá giới hạn request (Rate limit) trên Groq Free tier.');
        } else {
            logger.error(`[Translator] ❌ Lỗi khi gọi Groq API: ${error.message}`);
        }
        return null;
    }
}

module.exports = { translateToVietnamese };
