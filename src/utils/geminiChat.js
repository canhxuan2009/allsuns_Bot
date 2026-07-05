/**
 * geminiChat.js — Module kết nối với Google AI Studio (Gemini API)
 *
 * Sử dụng REST API trực tiếp qua fetch để giảm phụ thuộc thư viện ngoài.
 */

const logger = require('./logger');

/**
 * Gửi nội dung hội thoại tới Google AI Studio (Gemini) API
 * 
 * @param {Array} contents - Danh sách tin nhắn theo cấu trúc Gemini: [{ role: 'user'|'model', parts: [{ text: string }] }]
 * @returns {Promise<string|null>} Phản hồi từ Gemini, hoặc null nếu lỗi
 */
async function chatWithGemini(contents) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error('[Gemini] GEMINI_API_KEY chưa được cấu hình trong file .env!');
        return null;
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const systemInstructionText = process.env.GEMINI_SYSTEM_INSTRUCTION;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: contents
    };

    // Nếu cấu hình systemInstruction, thêm vào request
    if (systemInstructionText && systemInstructionText.trim().length > 0) {
        requestBody.systemInstruction = {
            parts: [
                {
                    text: systemInstructionText.trim()
                }
            ]
        };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[Gemini] Lỗi API (${response.status}): ${errorText}`);
            return null;
        }

        const data = await response.json();
        
        // Trích xuất text phản hồi từ cấu trúc API
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text || text.trim().length === 0) {
            logger.warn('[Gemini] Nhận phản hồi rỗng từ API.');
            return null;
        }

        return text.trim();
    } catch (error) {
        logger.error(`[Gemini] Lỗi kết nối tới Gemini API: ${error.message}`);
        return null;
    }
}

module.exports = { chatWithGemini };
