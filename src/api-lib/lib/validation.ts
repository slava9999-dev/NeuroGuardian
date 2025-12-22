// ============================================
// NeuroGUARDIAN — Input Validation
// Sanitization and validation utilities
// ============================================

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize API key - only allow valid characters
 */
export function sanitizeApiKey(key: string): string {
  if (typeof key !== 'string') return '';
  // API keys typically contain alphanumeric, hyphens, underscores
  return key.replace(/[^a-zA-Z0-9\-_]/g, '');
}

/**
 * Validate Telegram user ID
 */
export function isValidTelegramId(id: unknown): boolean {
  if (typeof id === 'number') {
    return Number.isInteger(id) && id > 0;
  }
  if (typeof id === 'string') {
    const num = parseInt(id, 10);
    return !isNaN(num) && num > 0;
  }
  return false;
}

/**
 * Validate price value
 */
export function isValidPrice(price: unknown): boolean {
  if (typeof price !== 'number') return false;
  return price >= 0 && price <= 10000000 && Number.isFinite(price);
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(percent: unknown): boolean {
  if (typeof percent !== 'number') return false;
  return percent >= 0 && percent <= 100;
}

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse and validate period string (e.g., "7d", "30d", "today")
 */
export function parsePeriod(period: string): { valid: boolean; days: number } {
  const periodMap: Record<string, number> = {
    today: 1,
    '1d': 1,
    '7d': 7,
    '14d': 14,
    '30d': 30,
    '90d': 90,
  };

  const days = periodMap[period.toLowerCase()];
  if (days !== undefined) {
    return { valid: true, days };
  }

  // Try to parse as number
  const match = period.match(/^(\d+)d?$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 365) {
      return { valid: true, days: num };
    }
  }

  return { valid: false, days: 7 }; // Default to 7 days
}
