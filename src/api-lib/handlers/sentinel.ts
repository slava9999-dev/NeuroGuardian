// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring logic
// REFACTORED: Uses MarketplaceService for all API calls
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

import { validateTelegramInitData, getSecret } from '../lib/index.js';
import { getSecurityAgent } from '@neuroguardian/security-agent';
import { verifyAdminAccessAsync, extractTelegramAuth } from '../middleware/auth.js';

import {
  getUserById,
  getMarketplaceKeys,
  setOzonZeroStock,
  setOzonDefensePrice,
  fetchWbPrices,
  setWbZeroStock,
  setWbDefensePrice,
  fetchOzonCurrentPrices,
} from '../services/index.js';

// ============================================
// TYPES
// ============================================

interface MonitoredProduct {
  id: number;
  product_id: string;
  nm_id?: number;
  title: string;
  min_price: number;
  current_price?: number; // From DB, updated by sync
  updated_at?: string; // For cooldown check
  vendor_code?: string;
  offer_id?: string; // Ozon offer_id (required for price updates)
  card_discount_buffer?: number; // Per-product card discount buffer (%)
}

interface SentinelAlertData {
  title: string;
  currentPrice: number;
  minPrice: number;
  effectiveMinPrice?: number; // min_price + buffer
  defenseAction: string;
  savedAmount: number;
  isWarning?: boolean; // True if this is a warning, not a trigger
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
  // 1. Authentication
  // Support Bearer token (Cron), Admin key, or Telegram initData
  const isAdmin = await verifyAdminAccessAsync(req);
  const auth = extractTelegramAuth(req);

  // TEST_MODE: bypass subscription check
  const isTestMode = process.env.TEST_MODE === 'true';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targetUsers: any[] = [];

  // Scenario A: Auto/Admin Run (All Users)
  if (isAdmin) {
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
  else if (auth.success) {
    const userId = auth.context.userId;
    // Get full user data from DB to check protection status
    const dbUser = await getUserById(userId);
    if (dbUser && dbUser.protection_enabled && (dbUser.api_key_ozon || dbUser.api_key_wb)) {
      targetUsers = [dbUser];
    } else {
      return res.json({ success: true, message: 'Protection disabled or keys missing' });
    }
  } else {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log(`🛡️ SENTINEL: Starting price check for ${targetUsers.length} users...`);

  // Check if n8n workflow wants details immediately
  const includeDetails = req.query.include_details === 'true';

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
  const violations: Array<{
    product_id: string;
    title: string;
    marketplace: string;
    current_price: number;
    min_price: number;
    action: string;
  }> = []; // For include_details mode

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
                  violations: includeDetails ? violations : undefined,
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
                  violations: includeDetails ? violations : undefined,
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

    // Return format based on include_details
    if (includeDetails) {
      return res.json({
        success: true,
        violations,
        total: violations.length,
        scanned: totalScanned,
      });
    }

    return res.json({
      success: true,
      scanned: totalScanned,
      triggered: totalTriggered,
      violations_found: totalTriggered,
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
  violations?: Array<{
    product_id: string;
    title: string;
    marketplace: string;
    current_price: number;
    min_price: number;
    action: string;
  }>;
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

  console.log(
    `📦 Ozon: Found ${monitoredProducts.length} products with stop-loss for user ${user.id}`
  );

  if (monitoredProducts.length === 0) return;

  // CRITICAL FIX (Dec 2024): Fetch LIVE prices from Ozon API
  // Previously used stale DB prices which caused "blind" Sentinel
  const productIds = monitoredProducts
    .map(p => parseInt(p.product_id.replace('ozon-', '')))
    .filter(id => !isNaN(id));

  console.log(`📡 Ozon: Fetching LIVE prices for ${productIds.length} products...`);
  const livePriceMap = await fetchOzonCurrentPrices(clientId, apiKey, productIds);
  console.log(`💰 Ozon: Got ${livePriceMap.size} live prices from API`);

  // Check for violations
  for (const dbProduct of monitoredProducts) {
    const ozonId = parseInt(dbProduct.product_id.replace('ozon-', ''));

    // LIVE price from API (with DB fallback for edge cases)
    const livePrice = livePriceMap.get(ozonId);
    const currentPrice = livePrice ?? dbProduct.current_price ?? 0;
    const offerId = dbProduct.offer_id || ''; // offer_id from sync

    // Log price source for debugging
    if (livePrice) {
      console.log(`📊 Ozon ${ozonId}: LIVE price = ${livePrice}₽`);
    } else if (dbProduct.current_price) {
      console.warn(
        `⚠️ Ozon ${ozonId}: No LIVE price, using DB fallback = ${dbProduct.current_price}₽`
      );
    }

    if (currentPrice === 0) {
      console.warn(`⚠️ No price for Ozon product ${ozonId} - run sync first`);
      continue;
    }

    if (!offerId) {
      console.warn(`⚠️ No offer_id in DB for Ozon product ${ozonId} - run sync first`);
      continue;
    }

    const minPrice = dbProduct.min_price;
    callbacks.onScan();

    // PRICE BUFFER: Account for card discounts (Ozon Card up to 30%, WB Pay up to 6%)
    // User setting: price_buffer_percent (default 5%)
    // Product override: card_discount_buffer (if > 0)
    const userBuffer = user.price_buffer_percent || 5; // Default 5%
    const productBuffer = dbProduct.card_discount_buffer || 0;
    const bufferPercent = productBuffer > 0 ? productBuffer : userBuffer;
    const effectiveMinPrice = Math.round(minPrice * (1 + bufferPercent / 100));

    // WARNING THRESHOLD: Alert before stop-loss triggers
    const warningThreshold = user.warning_threshold_percent || 10; // Default 10%
    const warningPrice = Math.round(minPrice * (1 + warningThreshold / 100));

    console.log(
      `📊 Check: ${dbProduct.title.substring(0, 30)}... | Current: ${currentPrice} | Min: ${minPrice} | Effective: ${effectiveMinPrice} | Warning: ${warningPrice}`
    );

    // Update current_price in DB for analytics
    await sql`
      UPDATE products SET current_price = ${Math.round(currentPrice)}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${dbProduct.id}
    `;

    // WARNING: Price approaching limit (but not violated yet)
    const isInWarningZone = currentPrice > minPrice && currentPrice <= warningPrice;
    const isViolation = currentPrice > 0 && currentPrice < effectiveMinPrice;

    if (isInWarningZone && !isViolation) {
      console.log(
        `⚠️ WARNING ZONE: ${dbProduct.title} - Price ${currentPrice} approaching min ${minPrice}`
      );

      // Send warning (only once per hour)
      const lastWarning = new Date(dbProduct.updated_at || 0);
      const hoursSinceWarning = (new Date().getTime() - lastWarning.getTime()) / 1000 / 60 / 60;

      if (hoursSinceWarning > 1) {
        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          effectiveMinPrice,
          defenseAction: '⚠️ Цена приближается к лимиту!',
          savedAmount: 0,
          marketplace: 'Ozon',
          isWarning: true,
        });
      }
    }

    // VIOLATION DETECTED! (using effectiveMinPrice with buffer)
    if (isViolation) {
      console.warn(
        `🚨 ALARM: ${dbProduct.title} Price: ${currentPrice} < EffectiveMin: ${effectiveMinPrice} (StopLoss: ${minPrice} + ${bufferPercent}% buffer)`
      );

      // RATE LIMITING: Check if we changed this product recently (last 10 minutes)
      const lastUpdate = new Date(dbProduct.updated_at || 0);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;

      if (minutesSinceUpdate < 10) {
        console.log(
          `⏳ Cooldown: Product ${ozonId} was updated ${Math.round(minutesSinceUpdate)}m ago, skipping`
        );
        continue;
      }

      callbacks.onTrigger();

      let defenseAction = '';
      let defenseResult: { success: boolean; error?: string };

      if (user.defense_mode === 'zero_stock') {
        // Option A: Set Stock to 0
        defenseAction = 'Zero Stock';
        defenseResult = await setOzonZeroStock(clientId, apiKey, [{ productId: ozonId, offerId }]);
      } else {
        // Option B: Price Correction (Set to min_price)
        defenseAction = 'Price Correction';
        defenseResult = await setOzonDefensePrice(clientId, apiKey, [
          { productId: ozonId, offerId, price: minPrice },
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

  console.log(
    `📦 WB: Found ${monitoredProducts.length} products with stop-loss for user ${user.id}`
  );

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

    // PRICE BUFFER: Account for WB Pay discounts (up to 6%) and SPP (up to 25%)
    const userBuffer = user.price_buffer_percent || 5; // Default 5%
    const productBuffer = dbProduct.card_discount_buffer || 0;
    const bufferPercent = productBuffer > 0 ? productBuffer : userBuffer;
    const effectiveMinPrice = Math.round(minPrice * (1 + bufferPercent / 100));

    // WARNING THRESHOLD
    const warningThreshold = user.warning_threshold_percent || 10;
    const warningPrice = Math.round(minPrice * (1 + warningThreshold / 100));

    console.log(
      `📊 WB Check: ${dbProduct.title.substring(0, 30)}... | Current: ${currentPrice} | Min: ${minPrice} | Effective: ${effectiveMinPrice}`
    );

    // WARNING ZONE
    const isInWarningZone = currentPrice > minPrice && currentPrice <= warningPrice;
    const isViolation = currentPrice > 0 && currentPrice < effectiveMinPrice;

    if (isInWarningZone && !isViolation) {
      console.log(
        `⚠️ WB WARNING: ${dbProduct.title} - Price ${currentPrice} approaching min ${minPrice}`
      );

      const lastWarning = new Date(dbProduct.updated_at || 0);
      const hoursSinceWarning = (new Date().getTime() - lastWarning.getTime()) / 1000 / 60 / 60;

      if (hoursSinceWarning > 1) {
        await sendSentinelAlert(user.id, {
          title: dbProduct.title,
          currentPrice,
          minPrice,
          effectiveMinPrice,
          defenseAction: '⚠️ Цена приближается к лимиту!',
          savedAmount: 0,
          marketplace: 'WB',
          isWarning: true,
        });
      }
    }

    // VIOLATION DETECTED! (using effectiveMinPrice with buffer)
    if (isViolation) {
      console.warn(
        `🚨 WB ALARM: ${dbProduct.title} Price: ${currentPrice} < EffectiveMin: ${effectiveMinPrice} (StopLoss: ${minPrice} + ${bufferPercent}% buffer)`
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
  const agent = getSecurityAgent();
  if (!agent.isInitialized()) await agent.initialize();

  const token = await getSecret('telegram_bot_token', 'send_telegram_alert');

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
  } else if (data.isWarning) {
    // WARNING ALERT (price approaching limit)
    const effectiveInfo = data.effectiveMinPrice
      ? `\n🛡️ <b>Эффективный минимум:</b> ${data.effectiveMinPrice}₽ (с буфером)`
      : '';
    msg =
      `⚠️ <b>NeuroGUARDIAN СТОРОЖ</b>\n\n` +
      `🔔 <b>ВНИМАНИЕ: Цена приближается к лимиту!</b>\n` +
      `📅 ${date} в ${time}\n\n` +
      `${marketplaceEmoji} <b>${data.marketplace || 'Маркетплейс'}</b>\n` +
      `📦 ${data.title}\n\n` +
      `💰 <b>Текущая цена:</b> ${data.currentPrice}₽\n` +
      `🚨 <b>Минимум:</b> ${data.minPrice}₽${effectiveInfo}\n\n` +
      `💡 <i>Если цена упадёт ещё — сработает Сторож.</i>`;
  } else {
    // SUCCESS ALERT - ГИБРИДНЫЙ ВАРИАНТ (Dec 2024)
    const wasBelow = data.currentPrice < data.minPrice;
    const difference = Math.abs(data.minPrice - data.currentPrice);

    // Короткое название (макс 60 символов)
    const shortTitle = data.title.length > 60 ? data.title.substring(0, 57) + '...' : data.title;

    let headerEmoji = '';
    let headerText = '';
    let priceBlock = '';
    let resultBlock = '';
    let tipBlock = '';

    if (wasBelow) {
      // СЦЕНАРИЙ 1: Реальная атака — цена была НИЖЕ минимума
      headerEmoji = '🚨';
      headerText = 'ЦЕНУ СНИЗИЛИ — МЫ ВЕРНУЛИ';
      priceBlock =
        `💸 <b>Было:</b> <s>${data.currentPrice}₽</s> (на ${difference}₽ ниже)\n` +
        `✅ <b>Стало:</b> ${data.minPrice}₽`;
      resultBlock = `💰 <b>Защитили:</b> ${difference}₽`;
      tipBlock = `💡 <i>Проверьте конкурентов</i>`;
    } else if (difference === 0) {
      // СЦЕНАРИЙ 2: Превентивная защита — цена РАВНА минимуму
      headerEmoji = '✅';
      headerText = 'ЗАЩИТА СРАБОТАЛА';
      priceBlock =
        `💰 <b>Цена:</b> ${data.minPrice}₽\n` + `🔒 <b>Статус:</b> Зафиксирована на минимуме`;
      resultBlock = `🛡️ <b>Результат:</b> Цена не упадёт ниже`;
      tipBlock = `💡 <i>Всё под контролем</i>`;
    } else {
      // СЦЕНАРИЙ 3: Цена приближалась к минимуму
      headerEmoji = '⚠️';
      headerText = 'ЦЕНА ПРИБЛИЖАЛАСЬ К МИНИМУМУ';
      priceBlock =
        `📊 <b>Было:</b> ${data.currentPrice}₽\n` + `🔒 <b>Защитили на:</b> ${data.minPrice}₽`;
      resultBlock = `🛡️ <b>Результат:</b> Снижение остановлено`;
      tipBlock = `💡 <i>Превентивная защита</i>`;
    }

    // СБОРКА СООБЩЕНИЯ
    msg =
      `🛡️ <b>СТОРОЖ</b>\n\n` +
      `${headerEmoji} <b>${headerText}</b>\n\n` +
      `${marketplaceEmoji} ${data.marketplace || 'Маркетплейс'} • ${time}\n` +
      `📦 ${shortTitle}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${priceBlock}\n\n` +
      `⚔️ <b>Действие:</b> ${data.defenseAction}\n` +
      `${resultBlock}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✅ <b>Товар защищён!</b> ${tipBlock}`;
  }

  try {
    // Step 1: Send a short voice message "siren" to get attention
    // This makes Telegram play a different notification sound
    // Skip audio for warnings (less urgent) - only play for actual triggers and errors
    const sirenUrl = 'https://cdn.pixabay.com/audio/2022/03/10/audio_23a6d0e89a.mp3'; // Short alert sound

    if (!data.isWarning) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            voice: sirenUrl,
            caption: data.isError ? '🆘 КРИТИЧЕСКАЯ ОШИБКА!' : '🚨 СТОРОЖ СРАБОТАЛ!',
            duration: 2,
          }),
        });
      } catch {
        // Voice sending failed, continue with text
        console.warn('Voice alert failed, sending text only');
      }
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
