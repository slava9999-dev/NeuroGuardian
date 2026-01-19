// ============================================
// NeuroGUARDIAN — URL Validator
// Server-side whitelist for external links
// Version: 3.0.0 | Date: December 2024
// ============================================

/**
 * Allowed domains for external links
 * Only URLs from these domains will pass validation
 */
export const ALLOWED_HOSTS = [
  // Wildberries
  'wildberries.ru',
  'www.wildberries.ru',
  'wb.ru',
  'www.wb.ru',

  // Ozon
  'ozon.ru',
  'www.ozon.ru',

  // Telegram (for support links)
  't.me',
  'telegram.me',

  // Official documentation
  'seller.wildberries.ru',
  'seller.ozon.ru',
];

/**
 * Blocked patterns (known fake/hallucinated domains)
 */
export const BLOCKED_PATTERNS = [
  /am\.ozon\.com/i, // Hallucinated domain
  /ozon\.com/i, // Wrong TLD
  /wildberries\.com/i, // Wrong TLD
  /example\.com/i, // Placeholder
  /localhost/i, // Local
  /127\.0\.0\.1/i, // Local
];

export interface ValidatedLink {
  url: string;
  isValid: boolean;
  domain?: string;
  reason?: string;
}

/**
 * Validate a single URL against whitelist
 */
export function validateUrl(rawUrl: string): ValidatedLink {
  try {
    // Clean the URL first
    const cleanedUrl = cleanUrl(rawUrl);
    if (!cleanedUrl) {
      return { url: rawUrl, isValid: false, reason: 'Invalid URL format' };
    }

    const parsed = new URL(cleanedUrl);

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url: rawUrl, isValid: false, reason: 'Invalid protocol' };
    }

    const host = parsed.hostname.toLowerCase();

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(cleanedUrl)) {
        return { url: rawUrl, isValid: false, domain: host, reason: 'Blocked pattern' };
      }
    }

    // Check whitelist
    const isAllowed = ALLOWED_HOSTS.some(
      allowed => host === allowed || host.endsWith('.' + allowed)
    );

    if (!isAllowed) {
      return { url: rawUrl, isValid: false, domain: host, reason: 'Domain not in whitelist' };
    }

    return { url: cleanedUrl, isValid: true, domain: host };
  } catch {
    return { url: rawUrl, isValid: false, reason: 'URL parsing error' };
  }
}

/**
 * Clean URL from HTML garbage and formatting issues
 * Handles cases where GPT generates broken HTML inside markdown links
 */
export function cleanUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim();

  // First, extract just the URL part before any HTML attributes
  // This handles: https://example.com/" target="_blank" ... >Text)
  const htmlAttrMatch = url.match(/^(https?:\/\/[^"'\s<>]+?)(?:\/)?["'\s]/);
  if (htmlAttrMatch) {
    url = htmlAttrMatch[1];
  }

  // Remove everything after " target= or " rel= or similar HTML attributes
  url = url.replace(/["']\s*(?:target|rel|class|style|onclick|href)\s*=.*$/gi, '');

  // Remove trailing HTML tags and content
  url = url.replace(/<[^>]+>.*$/gi, '');

  // Remove trailing quotes, parentheses, brackets, angle brackets
  url = url.replace(/[)"'>\]]+$/, '');

  // Remove trailing slash followed by garbage
  url = url.replace(/\/["'].*$/, '');

  // Remove leading garbage before http
  url = url.replace(/^[^h]*(?=https?:\/\/)/i, '');

  // Extract URL if it's inside markdown link [text](url)
  const markdownMatch = url.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (markdownMatch) {
    url = markdownMatch[2];
  }

  // Validate basic URL structure
  if (!url.match(/^https?:\/\//i)) {
    return null;
  }

  try {
    // Normalize the URL
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validate array of links to agent response
 */
export function validateLinks(
  links: Array<{ title: string; url: string; source: string }>
): Array<{ title: string; url: string; source: string }> {
  return links
    .map(link => {
      const validated = validateUrl(link.url);
      if (validated.isValid) {
        return { ...link, url: validated.url };
      }
      console.warn(`🚫 Blocked invalid URL: ${link.url} (${validated.reason})`);
      return null;
    })
    .filter((link): link is { title: string; url: string; source: string } => link !== null);
}

/**
 * Extract and validate URLs from text content
 */
export function extractValidUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = text.match(urlPattern) || [];

  return matches
    .map(url => {
      const validated = validateUrl(url);
      return validated.isValid ? validated.url : null;
    })
    .filter((url): url is string => url !== null);
}

/**
 * Replace invalid URLs with search links
 */
export function sanitizeTextUrls(text: string): string {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;

  return text.replace(urlPattern, match => {
    const validated = validateUrl(match);
    if (validated.isValid) {
      return validated.url;
    }

    // Try to extract product name for search
    const productMatch = match.match(/product[/-]([^/?]+)/i);
    if (productMatch && validated.domain?.includes('ozon')) {
      const searchQuery = encodeURIComponent(productMatch[1].replace(/[-_]/g, ' '));
      return `https://www.ozon.ru/search/?text=${searchQuery}`;
    }
    if (productMatch && validated.domain?.includes('wildberries')) {
      const searchQuery = encodeURIComponent(productMatch[1].replace(/[-_]/g, ' '));
      return `https://www.wildberries.ru/catalog/0/search.aspx?search=${searchQuery}`;
    }

    // Remove invalid URL entirely
    console.warn(`🚫 Removed hallucinated URL: ${match}`);
    return '[ссылка удалена]';
  });
}

/**
 * Generate search URL for marketplace
 */
export function generateSearchUrl(query: string, marketplace: 'WB' | 'Ozon'): string {
  const encodedQuery = encodeURIComponent(query);

  if (marketplace === 'Ozon') {
    return `https://www.ozon.ru/search/?text=${encodedQuery}`;
  }

  return `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodedQuery}`;
}
