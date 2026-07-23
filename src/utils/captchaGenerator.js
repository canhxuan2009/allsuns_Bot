const { createCanvas } = require('canvas');

// Tập ký tự dễ đọc (loại bỏ các ký tự dễ nhầm: 0, O, I, l, 1)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CAPTCHA_LENGTH = 5;

/**
 * Sinh mã CAPTCHA ngẫu nhiên
 * @returns {string}
 */
function randomCode() {
    let code = '';
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return code;
}

/**
 * Tạo hình ảnh CAPTCHA và trả về buffer PNG
 * @returns {{ code: string, buffer: Buffer }}
 */
function generateCaptcha() {
    const WIDTH = 260;
    const HEIGHT = 90;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // ── Nền gradient ──────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, `hsl(${rand(200, 240)}, 60%, 92%)`);
    bg.addColorStop(1, `hsl(${rand(200, 240)}, 50%, 85%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ── Điểm nhiễu (dots) ─────────────────────────────────────────────────
    for (let i = 0; i < 120; i++) {
        ctx.beginPath();
        ctx.arc(rand(0, WIDTH), rand(0, HEIGHT), rand(1, 2.5), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${rand(0, 360)}, 50%, 50%, ${0.2 + Math.random() * 0.4})`;
        ctx.fill();
    }

    // ── Đường nhiễu (noise lines) ─────────────────────────────────────────
    for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(rand(0, WIDTH), rand(0, HEIGHT));
        ctx.bezierCurveTo(
            rand(0, WIDTH), rand(0, HEIGHT),
            rand(0, WIDTH), rand(0, HEIGHT),
            rand(0, WIDTH), rand(0, HEIGHT)
        );
        ctx.strokeStyle = `hsla(${rand(0, 360)}, 60%, 50%, ${0.15 + Math.random() * 0.25})`;
        ctx.lineWidth = rand(1, 2);
        ctx.stroke();
    }

    // ── Vẽ các ký tự CAPTCHA ──────────────────────────────────────────────
    const code = randomCode();
    const charW = WIDTH / (CAPTCHA_LENGTH + 1);

    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        const x = charW * 0.6 + i * charW;
        const y = HEIGHT / 2 + rand(-8, 8);
        const angle = (Math.random() - 0.5) * 0.55; // ± ~15°
        const fontSize = rand(36, 46);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Bóng chữ nhạt
        ctx.font = `bold ${fontSize}px 'Arial'`;
        ctx.fillStyle = `hsla(${rand(200, 260)}, 40%, 80%, 0.6)`;
        ctx.fillText(ch, 2, 2);

        // Chữ chính
        ctx.fillStyle = `hsl(${rand(210, 260)}, 70%, 25%)`;
        ctx.fillText(ch, 0, 0);

        ctx.restore();
    }

    // ── Lưới nhiễu phủ lên trên ───────────────────────────────────────────
    for (let x = 0; x < WIDTH; x += rand(8, 14)) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.strokeStyle = `rgba(0,0,0,0.03)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    const buffer = canvas.toBuffer('image/png');
    return { code, buffer };
}

/**
 * Số nguyên ngẫu nhiên trong khoảng [min, max]
 */
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { generateCaptcha };
