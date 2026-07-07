/**
 * geminiHelper.js — Helper quản lý gọi Gemini API và tự động chuyển model khi hết quota
 * 
 * Hỗ trợ tự động chuyển đổi qua lại giữa các model khi gặp lỗi 429 (Too Many Requests / Quota Exceeded)
 * Có cơ chế cooldown để ưu tiên quay lại dùng các model tốt nhất sau khi chúng hồi phục RPM (Requests Per Minute).
 */

const logger = require('./logger');

// Danh sách các model AI dự phòng theo thứ tự ưu tiên (Ưu tiên model mạnh trước)
// Dựa vào RPM để phân bổ hợp lý, model mạnh (RPM thấp) sẽ dùng trước, hết RPM sẽ lùi về model RPM cao
const DEFAULT_FALLBACK_MODELS = [
    'gemini-3.5-flash',       // Chất lượng cao nhất, RPM: 5
    'gemini-3.1-flash-lite',  // Tốc độ cao, RPM: 15
    'gemini-2.5-flash',       // Chất lượng cao, RPM: 5
    'gemini-2.5-flash-lite',  // Tốc độ cao, RPM: 10
    'gemma-4-31b',            // Model open-weight lớn, RPM: 15
    'gemma-4-26b'             // Model open-weight, RPM: 15
];

// Lấy model ưu tiên cao nhất từ .env, nếu không có thì lấy phần tử đầu tiên
const PRIMARY_MODEL = process.env.GEMINI_MODEL || DEFAULT_FALLBACK_MODELS[0];

// Xây dựng danh sách model sẽ thử: đảm bảo PRIMARY_MODEL ở đầu
const modelsToTry = [PRIMARY_MODEL];
for (const model of DEFAULT_FALLBACK_MODELS) {
    if (!modelsToTry.includes(model)) {
        modelsToTry.push(model);
    }
}

// Lưu trữ thời gian model có thể được dùng lại (do bị lỗi 429)
// { "model-name": timestamp_cooldown_hết_hạn }
const modelCooldowns = {};

// Biến lưu trạng thái model đang active, dùng để log khi thay đổi
let currentActiveModel = PRIMARY_MODEL;

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

    const now = Date.now();
    
    // Lọc ra danh sách các model hiện không bị cooldown
    // Vẫn giữ nguyên thứ tự ưu tiên ban đầu
    let availableModels = modelsToTry.filter(model => !modelCooldowns[model] || now > modelCooldowns[model]);
    
    // Nếu tất cả đều đang cooldown, cứ lấy toàn bộ danh sách để thử ép gọi
    if (availableModels.length === 0) {
        logger.warn('[GeminiHelper] ⚠️ Tất cả các model đều đang trong thời gian cooldown! Đang thử ép gọi lại...');
        availableModels = [...modelsToTry];
    }

    // Thử lần lượt các model đang available
    for (let i = 0; i < availableModels.length; i++) {
        const modelName = availableModels[i];
        
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
                // Phạt cooldown 60 giây vì đã cạn RPM
                logger.warn(`[GeminiHelper] ⚠️ Model ${modelName} hết quota/RPM (Lỗi 429). Bắt đầu cooldown 60s và chuyển sang model khác...`);
                modelCooldowns[modelName] = Date.now() + 60 * 1000;
                continue; // Thử model tiếp theo
            }

            if (!response.ok) {
                const errorText = await response.text();
                // Lỗi 401, 403 thường là do key hỏng/hết hạn, không nên thử thêm
                if (response.status === 401 || response.status === 403) {
                    logger.error(`[GeminiHelper] ❌ Sai API Key hoặc không có quyền truy cập API (${response.status}): ${errorText}`);
                    return null;
                }
                
                // Lỗi 404 có thể do model không tồn tại
                if (response.status === 404) {
                    logger.error(`[GeminiHelper] ❌ Model ${modelName} không tồn tại hoặc URL sai (${response.status}). Thử model khác...`);
                    modelCooldowns[modelName] = Date.now() + 5 * 60 * 1000; // Phạt 5 phút
                    continue;
                }
                
                // Lỗi 503 Overloaded thì cho cooldown ngắn 10 giây
                if (response.status === 503) {
                    logger.warn(`[GeminiHelper] ⚠️ Máy chủ quá tải với model ${modelName} (Lỗi 503). Đang cooldown 10s...`);
                    modelCooldowns[modelName] = Date.now() + 10 * 1000;
                    continue;
                }

                logger.error(`[GeminiHelper] Lỗi khi gọi Gemini API với model ${modelName} (${response.status}): ${errorText}`);
                continue; // Thử model tiếp theo
            }

            const data = await response.json();
            
            // Nếu thành công, cập nhật log model active
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

    logger.error('[GeminiHelper] ❌ Tất cả các model AI đều thất bại hoặc đang bị limit quá nặng!');
    return null;
}

module.exports = {
    callGeminiWithFallback,
    getActiveModel: () => currentActiveModel
};
