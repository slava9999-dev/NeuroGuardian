"use strict";
// ============================================
// NeuroGUARDIAN — Telegram Auth Module
// HMAC-SHA256 validation of initData
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInitData = validateInitData;
exports.parseAndValidateInitData = parseAndValidateInitData;
exports.extractUserId = extractUserId;
const crypto = __importStar(require("crypto"));
const schemas_1 = require("../../schemas");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
/**
 * Parse initData string into object
 */
function parseInitData(initData) {
    const params = new URLSearchParams(initData);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}
/**
 * Validate Telegram WebApp initData using HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateInitData(initData) {
    if (!initData || !BOT_TOKEN) {
        console.error('Missing initData or BOT_TOKEN');
        return false;
    }
    try {
        const parsed = parseInitData(initData);
        const hash = parsed.hash;
        if (!hash) {
            console.error('Missing hash in initData');
            return false;
        }
        // Remove hash from params and sort alphabetically
        delete parsed.hash;
        const dataCheckString = Object.keys(parsed)
            .sort()
            .map((key) => `${key}=${parsed[key]}`)
            .join('\n');
        // Create secret key from bot token
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(BOT_TOKEN)
            .digest();
        // Calculate expected hash
        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        // Compare hashes (timing-safe)
        const isValid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
        // Check auth_date is not too old (allow 24 hours)
        if (isValid && parsed.auth_date) {
            const authDate = parseInt(parsed.auth_date, 10);
            const now = Math.floor(Date.now() / 1000);
            const maxAge = 24 * 60 * 60; // 24 hours
            if (now - authDate > maxAge) {
                console.error('initData is too old');
                return false;
            }
        }
        return isValid;
    }
    catch (error) {
        console.error('Error validating initData:', error);
        return false;
    }
}
/**
 * Parse and validate initData, returning typed user data
 */
function parseAndValidateInitData(initData) {
    if (!validateInitData(initData)) {
        return null;
    }
    try {
        const parsed = parseInitData(initData);
        // Parse user JSON
        if (parsed.user) {
            parsed.user = JSON.parse(parsed.user);
        }
        // Validate with Zod
        const result = schemas_1.TelegramInitDataSchema.safeParse({
            query_id: parsed.query_id,
            user: parsed.user,
            auth_date: parseInt(parsed.auth_date, 10),
            hash: parsed.hash,
        });
        if (!result.success) {
            console.error('Zod validation failed:', result.error);
            return null;
        }
        return result.data;
    }
    catch (error) {
        console.error('Error parsing initData:', error);
        return null;
    }
}
/**
 * Extract user ID from initData (for quick checks)
 */
function extractUserId(initData) {
    try {
        const parsed = parseInitData(initData);
        if (parsed.user) {
            const user = JSON.parse(parsed.user);
            return user.id ?? null;
        }
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=telegramAuth.js.map