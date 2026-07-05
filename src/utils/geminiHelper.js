/**
 * geminiHelper.js — Helper quản lý gọi Gemini API và tự động chuyển model khi hết quota
 * 
 * Hỗ trợ tự động chuyển đổi qua lại giữa các model khi gặp lỗi 429 (Too Many Requests / Quota Exceeded)
 */

const logger = require('./logger');

// Danh sách các model Gemini dự phòng theo thứ tự ưu tiên
const DEFAULT_FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
];

// Model đang hoạt động tốt hiện tại (bắt đầu bằng model được cấu hình ở .env)
let currentActiveModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Danh sách tất cả các model ta sẽ thử (đưa model từ .env lên đầu nếu chưa có)
const modelsToTry = [currentActiveModel];
for (const model of DEFAULT_FALLBACK_MODELS) {
    if (!modelsToTry.includes(model)) {
        modelsToTry.push(model);
    }
}

/**
 * Gọi Gemini API với cơ chế tự động chuyển sang model dự phòng khi gặp lỗi 429
 * 
 * @param {object} requestBody - Body của request gửi đi
 * @returns {Promise<{data: any, modelUsed: string}|null>} Trả về data response từ API và model đã sử dụng thành công
 */
async function callGeminiWithFallback(requestBody) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error('[GeminiHelper] GEMINI_API_KEY chưa được cấu hình!');
        return null;
    }

    // Tìm vị trí của model hiện tại trong danh sách để biết bắt đầu thử từ đâu
    let startIndex = modelsToTry.indexOf(currentActiveModel);
    if (startIndex === -1) startIndex = 0;

    // Lặp qua các model trong danh sách bắt đầu từ model đang active
    for (let i = 0; i < modelsToTry.length; i++) {
        const modelIndex = (startIndex + i) % modelsToTry.length;
        const modelName = modelsToTry[modelIndex];
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        try {
            logger.info(`[GeminiHelper] Đang gọi API sử dụng model: ${modelName}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                logger.warn(`[GeminiHelper] ⚠️ Model ${modelName} hết quota hoặc quá giới hạn request (Lỗi 429). Đang chuyển sang model khác...`);
                continue; // Thử model tiếp theo
            }

            if (!response.ok) {
                const errorText = await response.text();
                // Nếu lỗi 401 hoặc 403 (sai API Key), không cần thử model khác
                if (response.status === 401 || response.status === 403) {
                    logger.error(`[GeminiHelper] ❌ Sai API Key hoặc không có quyền truy cập API (${response.status}): ${errorText}`);
                    return null;
                }
                
                logger.error(`[GeminiHelper] Lỗi khi gọi Gemini API với model ${modelName} (${response.status}): ${errorText}`);
                continue; // Thử model tiếp theo
            }

            const data = await response.json();
            
            // Nếu thành công và model sử dụng khác model cũ, ghi log đổi model active
            if (currentActiveModel !== modelName) {
                logger.info(`[GeminiHelper] 🔄 Đã đổi model hoạt động chính sang: ${modelName}`);
                currentActiveModel = modelName;
            }

            return { data, modelUsed: modelName };

        } catch (error) {
            logger.error(`[GeminiHelper] Lỗi kết nối khi gọi model ${modelName}: ${error.message}`);
            // Thử model tiếp theo
        }
    }

    logger.error('[GeminiHelper] ❌ Tất cả các model Gemini đều thất bại hoặc hết quota!');
    return null;
}

module.exports = {
    callGeminiWithFallback,
    getActiveModel: () => currentActiveModel
};
