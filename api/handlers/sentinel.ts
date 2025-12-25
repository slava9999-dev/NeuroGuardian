// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring logic
// REFACTORED: Uses MarketplaceService for all API calls
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

import { validateTelegramInitData } from '../../src/api-lib/lib/index.js';

import {
  getUserById,
  getMarketplaceKeys,
  fetchOzonCurrentPrices,
  fetchOzonProductInfo,
  setOzonZeroStock,
  setOzonDefensePrice,
  fetchWbPrices,
  setWbZeroStock,
  setWbDefensePrice,
} from '../../src/api-lib/services/index.js';

// ============================================
// TYPES
// ============================================

interface MonitoredProduct {
  id: number;
  product_id: string;
  nm_id?: number;
  title: string;
  min_price: number;
  vendor_code?: string;
}

interface SentinelAlertData {
  title: string;
  currentPrice: number;
  minPrice: number;
  defenseAction: string;
  savedAmount: number;
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Handle check-prices action (Sentinel Cron)
 */
export async function handleCheckPrices(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Allow Vercel Cron or manual Admin trigger or external cron with secret
  const authHeader = req.headers['authorization'];
  const initData = (req.headers['x-init-data'] as string) || '';
  const querySecret = req.query.secret as string;
  const adminKey = (req.query.key as string) || (req.headers['x-admin-key'] as string);

  // Check for cron authorization (Bearer header OR query parameter)
  const cronSecret = process.env.CRON_SECRET;
  const isCron =
    authHeader === `Bearer ${cronSecret}` ||
    (querySecret && cronSecret && querySecret === cronSecret);
  const isAdmin = adminKey === process.env.ADMIN_API_KEY;

  // TEST_MODE: bypass subscription check
  const isTestMode = process.env.TEST_MODE === 'true';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetUsers: any[] = [];

  // Scenario A: Auto/Admin Run (All Users)
  if (isCron || isAdmin) {
    // In TEST_MODE, check all users with protection enabled (ignore subscription)
    const usersRes = isTestMode
      ? await sql`
          SELECT * FROM users 
          WHERE protection_enabled = true 
          AND (api_key_ozon IS NOT NULL OR api_key_wb IS NOT NULL)
        `
      : await sql`
          SELECT * FROM users 
          WHERE protection_enabled = true 
          AND subscription_active = true
          AND (api_key_ozon IS NOT NULL OR api_key_wb IS NOT NULL)
        `;
    targetUsers = usersRes.rows;
  }
  // Scenario B: User Self-Check (Client Polling)
  else if (initData) {
    const validation = validateTelegramInitData(initData);
    if (validation.valid && validation.user) {
      // Get full user data from DB to check protection status
      const dbUser = await getUserById(validation.user.id);
      if (dbUser && dbUser.protection_enabled && (dbUser.api_key_ozon || dbUser.api_key_wb)) {
        targetUsers = [dbUser];
      } else {
        return res.json({ success: true, message: 'Protection disabled or keys missing' });
      }
    } else {
      return res.status(401).json({ error: 'Invalid initData' });
    }
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log(`🛡️ SENTINEL: Starting price check for ${targetUsers.length} users...`);

  // DEBUG MODE VARIABLES
  const isDebug = req.query.debug === 'true';
  const debugInfo: unknown[] = [];

  // Capture Logs
  const log: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  const safeLog = (...args: unknown[]) => {
    log.push(args.map(String).join(' '));
    originalLog(...args);
  };

  const safeError = (...args: unknown[]) => {
    log.push('[ERROR] ' + args.map(String).join(' '));
    originalError(...args);
  };

  // Use local loggers
  console.log = safeLog;
  console.error = safeError;

  let totalScanned = 0;
  let totalTriggered = 0;

  try {
    // Parallel Processing with Batching
    const BATCH_SIZE = 5;
    for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
      const batch = targetUsers.slice(i, i + BATCH_SIZE);
      console.log(
        `🛡️ Sentinel Batch ${Math.floor(i / BATCH_SIZE) + 1}: Processing ${batch.length} users...`
      );

      await Promise.all(
        batch.map(async user => {
          try {
            // Get decrypted API keys via MarketplaceService
            const keys = await getMarketplaceKeys(user.id);

            // --- OZON DEFENSE ---
            if (keys.ozon) {
              try {
                await processOzonDefense(user, keys.ozon, {
                  onScan: () => totalScanned++,
                  onTrigger: () => totalTriggered++,
                  log,
                });
              } catch (e) {
                console.error(`Error checking Ozon for user ${user.id}:`, e);
                log.push(`Error Ozon user ${user.id}: ${e}`);
              }
            }

            // --- WB DEFENSE ---
            if (keys.wb) {
              try {
                await processWbDefense(user, keys.wb, {
                  onScan: () => totalScanned++,
                  onTrigger: () => totalTriggered++,
                  log,
                });
              } catch (e) {
                console.error(`Error checking WB for user ${user.id}:`, e);
                log.push(`Error WB user ${user.id}: ${e}`);
              }
            }
          } catch (error) {
            console.error(`Error processing user ${user.id}:`, error);
          }
        })
      );
    }

    // Restore console
    console.log = originalLog;
    console.error = originalError;

    return res.json({
      success: true,
      scanned: totalScanned,
      triggered: totalTriggered,
      log,
      debug_info: isDebug ? debugInfo : undefined,
    });
  } catch (error) {
    console.error('Sentinel Error:', error);
    // Restore console in case of error
    console.log = originalLog;
    console.error = originalError;
    return res.status(500).json({ error: 'Sentinel check failed' });
  }
}

// ============================================
// OZON DEFENSE PROCESSOR
// ============================================

interface DefenseCallbacks {
  onScan: () => void;
  onTrigger: () => void;
  log: string[];
}

async function processOzonDefense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  ozonKeys: { clientId: string; apiKey: string },
  callbacks: DefenseCallbacks
): Promise<void> {
  const { clientId, apiKey } = ozonKeys;

  // Get monitored products from DB
  const productsRes = await sql`
    SELECT * FROM products 
    WHERE user_id = ${user.id} 
    AND marketplace = 'Ozon' 
    AND min_price > 0 
    AND status != 'disabled'
  `;
  const monitoredProducts: MonitoredProduct[] = productsRes.rows as MonitoredProduct[];

  if (monitoredProducts.length === 0) return;

  // Get product IDs for API calls
  const productIds = monitoredProducts.map(p => parseInt(p.product_id.replace('ozon-', '')));

  // Fetch current prices via MarketplaceService
  const priceMap = await fetchOzonCurrentPrices(clientId, apiKey, productIds);

  // Fetch product info (for offer_id) via MarketplaceService
  const productInfoMap = await fetchOzonProductInfo(clientId, apiKey, productIds);

  // Check for violations
  for (const dbProduct of monitoredProducts) {
    const ozonId = parseInt(dbProduct.product_id.replace('ozon-', ''));
    const productInfo = productInfoMap.get(ozonId);

    // Get price from prices API, or try item fields
    const currentPrice = priceMap.get(ozonId) || 0;

    if (currentPrice === 0) {
      console.warn(`⚠️ No price found for Ozon product ${ozonId}`);
      continue;
    }

    const minPrice = dbProduct.min_price;
    callbacks.onScan();

    console.log(
      `📊 Check: ${dbProduct.title.substring(0, 30)}... | Current: ${currentPrice} | Min: ${minPrice}`
    );

    // Update current_price in DB for analytics
    await sql`
      UPDATE products SET current_price = ${Math.round(currentPrice)}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${dbProduct.id}
    `;

    // VIOLATION DETECTED!
    if (currentPrice > 0 && currentPrice < minPrice) {
      console.warn(`🚨 ALARM: ${dbProduct.title} Price: ${currentPrice} < StopLoss: ${minPrice}`);
      callbacks.onTrigger();

      let defenseAction = '';
      let defenseResult: { success: boolean; error?: string };

      if (user.defense_mode === 'zero_stock') {
        // Option A: Set Stock to 0
        defenseAction = 'Zero Stock';
        defenseResult = await setOzonZeroStock(clientId, apiKey, [
          { productId: ozonId, offerId: productInfo?.offer_id || '' },
        ]);
      } else {
        // Option B: Price Correction (Set to min_price)
        defenseAction = 'Price Correction';
        defenseResult = await setOzonDefensePrice(clientId, apiKey, [
          { productId: ozonId, offerId: productInfo?.offer_id || '', price: minPrice },
        ]);
      }

      // Log defense action result
      console.log(`🛡️ Defense API response: ${defenseResult.success ? 'OK' : 'FAILED'}`);

      if (defenseResult.success) {
        // UPDATE DB & NOTIFY success
        await sql`
          UPDATE products SET status = 'triggered', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ${dbProduct.id}
        `;

        const savedAmount = minPrice - currentPrice;
        await sql`
          UPDATE users SET 
            triggered_today = triggered_today + 1,
            saved_amount = saved_amount + ${savedAmount}
          WHERE id = ${user.id}
        `;

        // Log to sentinel_logs
        await sql`
          INSERT INTO sentinel_logs (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
          VALUES (${user.id}, ${dbProduct.product_id}, ${dbProduct.title}, ${Math.round(currentPrice)}, ${minPrice}, ${defenseAction}, ${savedAmount}, 'Ozon')
        `;

        // TELEGRAM ALERT
        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          defenseAction,
          savedAmount,
          marketplace: 'Ozon',
        });
      } else {
        // DEFENSE FAILED
        console.error(
          `❌ ALARM: Defense FAILED for ${dbProduct.product_id}. Error: ${defenseResult.error}`
        );

        // Notify user about FAILURE
        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          defenseAction: `❌ ОШИБКА: ${defenseResult.error || 'API Error'}`,
          savedAmount: 0,
          marketplace: 'Ozon',
          isError: true,
        });
      }
    }
  }
}

// ============================================
// WB DEFENSE PROCESSOR
// ============================================

async function processWbDefense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  wbApiKey: string,
  callbacks: DefenseCallbacks
): Promise<void> {
  // Get monitored WB products from DB
  const productsRes = await sql`
    SELECT * FROM products 
    WHERE user_id = ${user.id} 
    AND marketplace = 'WB' 
    AND min_price > 0 
    AND status != 'disabled'
  `;
  const monitoredProducts: MonitoredProduct[] = productsRes.rows as MonitoredProduct[];

  if (monitoredProducts.length === 0) return;

  // Get nmIds for API calls
  const nmIds = monitoredProducts.map(p => p.nm_id).filter(Boolean) as number[];

  if (nmIds.length === 0) return;

  // Fetch current prices via MarketplaceService
  const { priceMap } = await fetchWbPrices(wbApiKey, nmIds);

  // Check for violations
  for (const dbProduct of monitoredProducts) {
    if (!dbProduct.nm_id) continue;

    const currentPrice = priceMap.get(dbProduct.nm_id) || 0;
    const minPrice = dbProduct.min_price;

    if (currentPrice === 0) {
      console.warn(`⚠️ No price found for WB product ${dbProduct.nm_id}`);
      continue;
    }

    callbacks.onScan();

    // VIOLATION DETECTED!
    if (currentPrice > 0 && currentPrice < minPrice) {
      console.warn(
        `🚨 WB ALARM: ${dbProduct.title} Price: ${currentPrice} < StopLoss: ${minPrice}`
      );
      callbacks.onTrigger();

      let defenseAction = '';
      let defenseResult: { success: boolean; error?: string };

      if (user.defense_mode === 'zero_stock') {
        // WB Zero Stock: Set stock to 0 via warehouse API
        defenseAction = 'Zero Stock';
        const sku = dbProduct.vendor_code || String(dbProduct.nm_id);
        defenseResult = await setWbZeroStock(wbApiKey, [sku]);
      } else {
        // WB Price Correction
        defenseAction = 'Price Correction';
        defenseResult = await setWbDefensePrice(wbApiKey, [
          { nmId: dbProduct.nm_id, price: minPrice },
        ]);
      }

      console.log(`🛡️ WB Defense: ${defenseResult.success ? 'OK' : 'FAILED'}`);

      if (defenseResult.success) {
        // UPDATE DB & NOTIFY success
        await sql`
          UPDATE products SET status = 'triggered', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ${dbProduct.id}
        `;

        const savedAmount = minPrice - currentPrice;
        await sql`
          UPDATE users SET 
            triggered_today = triggered_today + 1,
            saved_amount = saved_amount + ${savedAmount}
          WHERE id = ${user.id}
        `;

        // Log to sentinel_logs
        await sql`
          INSERT INTO sentinel_logs (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
          VALUES (${user.id}, ${dbProduct.product_id}, ${dbProduct.title}, ${Math.round(currentPrice)}, ${minPrice}, ${defenseAction}, ${savedAmount}, 'WB')
        `;

        // TELEGRAM ALERT
        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          defenseAction,
          savedAmount,
          marketplace: 'WB',
        });
      } else {
        // DEFENSE FAILED
        console.error(`❌ WB ALARM: Defense FAILED for ${dbProduct.nm_id}`);

        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          defenseAction: `❌ ОШИБКА: ${defenseResult.error || 'API Error'}`,
          savedAmount: 0,
          marketplace: 'WB',
          isError: true,
        });
      }
    }
  }
}

// ============================================
// HELPER: TELEGRAM ALERT
// ============================================

async function sendSentinelAlert(
  userId: number,
  data: SentinelAlertData & { marketplace?: string; isError?: boolean }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping alert');
    return;
  }

  const marketplaceEmoji = data.marketplace === 'WB' ? '🟣' : '🔵';
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const date = new Date().toLocaleDateString('ru-RU');

  let msg = '';

  if (data.isError) {
    // CRITICAL FAILURE ALERT
    msg =
      `🆘 <b>NeuroGUARDIAN SENTINEL</b>\n\n` +
      `❌ <b>ОШИБКА ЗАЩИТЫ!</b>\n` +
      `📅 ${date} в ${time}\n\n` +
      `${marketplaceEmoji} <b>${data.marketplace || 'Маркетплейс'}</b>\n` +
      `📦 ${data.title}\n\n` +
      `📉 Цена упала: <s>${data.minPrice}₽</s> → <b>${data.currentPrice}₽</b>\n` +
      `⚠️ <b>Ошибка:</b> ${data.defenseAction}\n\n` +
      `⚡ <b>СРОЧНО ИЗМЕНИТЕ ЦЕНУ ВРУЧНУЮ!</b>`;
  } else {
    // SUCCESS ALERT
    msg =
      `🛡️ <b>NeuroGUARDIAN SENTINEL</b>\n\n` +
      `⚠️ <b>АТАКА ОБНАРУЖЕНА!</b>\n` +
      `📅 ${date} в ${time}\n\n` +
      `${marketplaceEmoji} <b>${data.marketplace || 'Маркетплейс'}</b>\n` +
      `📦 ${data.title}\n\n` +
      `📉 Цена упала: <s>${data.minPrice}₽</s> → <b>${data.currentPrice}₽</b>\n` +
      `⚔️ <b>Защита:</b> ${data.defenseAction}\n` +
      `💰 <b>Спасено:</b> ${data.savedAmount}₽\n\n` +
      `✅ Ваш товар защищён!`;
  }

  try {
    // Step 1: Send a short voice message "siren" to get attention
    // This makes Telegram play a different notification sound
    // Using a pre-recorded alert sound hosted on a CDN
    const sirenUrl = 'https://cdn.pixabay.com/audio/2022/03/10/audio_23a6d0e89a.mp3'; // Short alert sound

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          voice: sirenUrl,
          caption: data.isError ? '🆘 КРИТИЧЕСКАЯ ОШИБКА!' : '🚨 АТАКА ОБНАРУЖЕНА!',
          duration: 2,
        }),
      });
    } catch {
      // Voice sending failed, continue with text
      console.warn('Voice alert failed, sending text only');
    }

    // Step 2: Send the detailed text message
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: msg,
        parse_mode: 'HTML',
        // Do NOT disable notification - we want it loud!
        disable_notification: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to send Telegram alert to ${userId}:`, error);
    } else {
      console.log(`✅ Telegram alert sent to ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error sending Telegram alert to ${userId}:`, error);
  }
}
