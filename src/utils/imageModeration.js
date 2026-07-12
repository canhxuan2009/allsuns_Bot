/**
 * imageModeration.js — Module kiểm duyệt hình ảnh bằng Gemini Vision API
 *
 * Tải ảnh từ URL Discord, chuyển đổi sang Base64, gửi tới Gemini API
 * để phân tích nội dung và phân loại: SCAM / NSFW / SAFE.
 */

const logger = require('./logger');
const { callGeminiWithFallback } = require('./geminiHelper');

// ─── System Prompt kiểm duyệt ảnh ──────────────────────────────────────
const MODERATION_PROMPT = `Bạn là hệ thống kiểm duyệt hình ảnh tự động cho một server Discord. Nhiệm vụ của bạn là phân tích hình ảnh và phân loại vào MỘT trong 3 danh mục sau:

1. **SCAM** — CHỈ gắn nhãn SCAM cho các hình ảnh rác liên quan trực tiếp đến Crypto/Tiền điện tử, bao gồm:
   - Quảng cáo tiền điện tử (crypto), Bitcoin, Altcoin, Token, NFT.
   - Các chương trình Crypto giveaway, airdrop coin lừa đảo.
   - Nhóm kéo sàn, đầu tư coin, kêu gọi mua bán tiền ảo.
   - LƯU Ý QUAN TRỌNG: Tất cả các hình thức lừa đảo khác (như Discord Nitro giả, Steam gift, quà tặng miễn phí, giả mạo người nổi tiếng...) mà KHÔNG liên quan đến Crypto/Tiền điện tử/Bitcoin đều phải được gắn nhãn SAFE.

2. **NSFW** — Hình ảnh có nội dung nhạy cảm:
   - Khiêu dâm, khoả thân, gợi dục
   - Bạo lực đồ hoạ, máu me quá mức
   - Nội dung gây sốc, kinh dị ghê tởm

3. **SAFE**
   - Hình ảnh bình thường, meme, joke, ảnh chụp màn hình thông thường không vi phạm các quy tắc trên.
   - Bất kể ảnh gì trong game Minecraft, tự động gắn nhãn SAFE.
   - Bất kỳ loại lừa đảo hay spam nào KHÔNG liên quan đến Crypto/Tiền điện tử/Bitcoin (ví dụ: Nitro giả, Steam giả, v.v.), cũng phải được gắn nhãn SAFE.
   - Các giao diện khác trong các website/app không chứa quảng cáo tiền điện tử, tự động gắn nhãn SAFE.

QUAN TRỌNG: Bạn PHẢI trả về CHÍNH XÁC một JSON object theo định dạng sau, KHÔNG thêm bất kỳ văn bản nào khác:
{"category":"SCAM","reason":"MÔ TẢ NGẮN GỌN LÝ DO"}
hoặc
{"category":"NSFW","reason":"MÔ TẢ NGẮN GỌN LÝ DO"}
hoặc
{"category":"SAFE","reason":"Ảnh bình thường"}`;

/**
 * Tải ảnh từ URL và chuyển thành Base64
 * 
 * @param {string} url - URL của ảnh cần tải
 * @returns {Promise<{base64: string, mimeType: string}|null>} Dữ liệu Base64 và MIME type
 */
async function fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            logger.error(`[ImageMod] Không thể tải ảnh từ URL (${response.status}): ${url}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            base64: base64,
            mimeType: contentType.split(';')[0].trim() // Lấy phần MIME type chính (bỏ charset nếu có)
        };
    } catch (error) {
        logger.error(`[ImageMod] Lỗi khi tải ảnh: ${error.message}`);
        return null;
    }
}

/**
 * Phân tích nội dung ảnh bằng Gemini Vision API
 * 
 * @param {string} imageUrl - URL ảnh cần phân tích
 * @returns {Promise<{category: 'SCAM'|'NSFW'|'SAFE', reason: string}|null>} Kết quả phân loại
 */
async function analyzeImage(imageUrl) {
    // Tải ảnh và chuyển sang Base64
    const imageData = await fetchImageAsBase64(imageUrl);
    if (!imageData) return null;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: imageData.mimeType,
                            data: imageData.base64
                        }
                    },
                    {
                        text: MODERATION_PROMPT
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1, // Rất thấp để đảm bảo kết quả nhất quán
            response_mime_type: 'application/json' // Yêu cầu Gemini trả JSON
        }
    };

    try {
        const result = await callGeminiWithFallback(requestBody);
        if (!result) {
            logger.error('[ImageMod] Không nhận được kết quả phân tích từ Gemini Helper.');
            return null;
        }

        const { data, modelUsed } = result;
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            logger.warn(`[ImageMod] Gemini (${modelUsed}) trả về kết quả rỗng.`);
            return null;
        }

        // Parse JSON response
        try {
            const resultObj = JSON.parse(resultText.trim());

            // Kiểm tra tính hợp lệ của response
            if (!resultObj.category || !['SCAM', 'NSFW', 'SAFE'].includes(resultObj.category)) {
                logger.warn(`[ImageMod] Gemini (${modelUsed}) trả về category không hợp lệ: ${resultText}`);
                return null;
            }

            logger.info(`[ImageMod] Kết quả phân tích (via ${modelUsed}): ${resultObj.category} — ${resultObj.reason}`);
            return resultObj;

        } catch (parseError) {
            logger.error(`[ImageMod] Không thể parse JSON từ Gemini (${modelUsed}): ${resultText}`);
            return null;
        }

    } catch (error) {
        logger.error(`[ImageMod] Lỗi kết nối khi gọi Gemini API: ${error.message}`);
        return null;
    }
}

module.exports = { analyzeImage };
