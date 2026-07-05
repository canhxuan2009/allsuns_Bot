/**
 * translator.js — Module dịch tự động thông báo DonutSMP (EN → VI)
 * 
 * Sử dụng Google AI Studio (Gemini API) để dịch nội dung tiếng Anh sang tiếng Việt chuẩn ngữ cảnh Minecraft.
 * Dùng model gemini-2.5-flash cho chất lượng dịch tốt nhất.
 * 
 * Cách hoạt động:
 * 1. Nhận nội dung tin nhắn tiếng Anh
 * 2. Gửi đến Gemini API kèm System Prompt chuyên biệt
 * 3. Trả về bản dịch tiếng Việt
 */

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

const { callGeminiWithFallback } = require('./geminiHelper');

// ─── Hàm dịch chính ────────────────────────────────────────────────────

/**
 * Dịch nội dung tiếng Anh sang tiếng Việt bằng Google AI Studio (Gemini API) có fallback.
 * 
 * @param {string} englishText - Nội dung tiếng Anh cần dịch
 * @returns {Promise<string|null>} Bản dịch tiếng Việt, hoặc null nếu lỗi
 */
async function translateToVietnamese(englishText) {
    if (!englishText || englishText.trim().length === 0) {
        logger.warn('[Translator] Nội dung rỗng, bỏ qua.');
        return null;
    }

    const requestBody = {
        systemInstruction: {
            parts: [
                {
                    text: SYSTEM_PROMPT
                }
            ]
        },
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: englishText
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.3 // Thấp để đảm bảo bám sát chỉ dẫn dịch thuật
        }
    };

    try {
        const result = await callGeminiWithFallback(requestBody);
        if (!result) {
            logger.error('[Translator] Không nhận được kết quả dịch từ Gemini Helper.');
            return null;
        }

        const { data, modelUsed } = result;
        const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!translatedText || translatedText.trim().length === 0) {
            logger.warn(`[Translator] Gemini (${modelUsed}) trả về kết quả rỗng.`);
            return null;
        }

        logger.info(`[Translator] Dịch thành công via Gemini ${modelUsed} (${englishText.length} → ${translatedText.length} ký tự)`);
        return translatedText.trim();

    } catch (error) {
        logger.error(`[Translator] ❌ Lỗi xử lý dịch: ${error.message}`);
        return null;
    }
}

module.exports = { translateToVietnamese };
