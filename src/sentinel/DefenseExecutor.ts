import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import {
  setWbDefensePrice,
  setWbZeroStock,
  setOzonDefensePrice,
  setOzonZeroStock,
  updateWbPrices,
  updateOzonPrices,
  getMarketplaceKeys,
} from '../api-lib/services/marketplace.js';
import { logSentinelAction } from '../api-lib/services/database.js';
import { sendAlert } from '../api-lib/services/notifications.js';
import type { SentinelRunResult, UserCycleResult } from './types.js';

export class SentinelDefenseExecutor {
  async executeDefense(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    marketplace: 'WB' | 'Ozon',
    summary: SentinelRunResult,
    threatType: string,
    userResult?: UserCycleResult
  ): Promise<void> {
    const defenseMode = user.defense_mode || 'price_correction';
    const minPrice = product.min_price;
    let success = false;
    let errorMsg = '';
    const keys = await getMarketplaceKeys(user.id);

    // Sanity check
    if (minPrice > livePrice * 5 && minPrice > 10000) {
      const msg = `⛔ Defense Aborted: min_price (${minPrice}) is suspiciously high vs live (${livePrice}) for ${product.title}.`;
      summary.errors.push(msg);
      if (userResult) userResult.errors.push(msg);
      return;
    }

    try {
      if (marketplace === 'WB' && keys.wb) {
        const nmId = product.nm_id;
        if (!nmId) throw new Error('Missing nmId for WB');
        if (defenseMode === 'zero_stock') {
          const res = await setWbZeroStock(keys.wb, [String(nmId)]);
          success = res.success;
          errorMsg = res.error || '';
        } else {
          const res = await setWbDefensePrice(keys.wb, [{ nmId, price: minPrice }]);
          success = res.success;
          errorMsg = res.error || '';
        }
      } else if (marketplace === 'Ozon' && keys.ozon) {
        const ozonId = parseInt(product.product_id.replace('ozon-', ''));
        const offerId = product.offer_id || product.product_id;
        if (defenseMode === 'zero_stock') {
          const res = await setOzonZeroStock(keys.ozon.clientId, keys.ozon.apiKey, [
            { productId: ozonId, offerId },
          ]);
          success = res.success;
          errorMsg = res.error || '';
        } else {
          const res = await setOzonDefensePrice(keys.ozon.clientId, keys.ozon.apiKey, [
            { productId: ozonId, offerId, price: minPrice },
          ]);
          success = res.success;
          errorMsg = res.error || '';
        }
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    const savedAmount = Math.max(0, minPrice - livePrice);
    if (success) {
      summary.actionsTaken++;
      if (userResult) {
        userResult.actionsTaken++;
        userResult.defenseDetails.push({
          product: product.title,
          action: defenseMode,
          marketplace,
          savedAmount,
        });
      }
      if (summary.defenseDetails) {
        summary.defenseDetails.push({ product: product.title, action: defenseMode, marketplace });
      }
      await this.notifyDefenseSuccess(user, product, livePrice, minPrice, defenseMode, marketplace);
    } else {
      const msg = `Defense failed for ${product.product_id}: ${errorMsg}`;
      summary.errors.push(msg);
      if (userResult) userResult.errors.push(msg);
    }

    await logSentinelAction({
      user_id: user.id,
      product_id: product.product_id,
      product_title: product.title,
      detected_price: livePrice,
      min_price: minPrice,
      defense_action: defenseMode,
      saved_amount: savedAmount,
      marketplace,
      threat_type: threatType,
      success,
    });
  }

  async executeSmartReprice(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    newPrice: number,
    marketplace: 'WB' | 'Ozon',
    summary: SentinelRunResult,
    details: { reason: string; competitorPrice?: number },
    userResult?: UserCycleResult
  ): Promise<void> {
    let updateSuccess = false;
    const keys = await getMarketplaceKeys(user.id);

    try {
      if (marketplace === 'WB' && product.nm_id && keys.wb) {
        const res = await updateWbPrices(keys.wb, [{ nmId: product.nm_id, price: newPrice }]);
        updateSuccess = res.success;
      } else if (marketplace === 'Ozon' && keys.ozon) {
        const res = await updateOzonPrices(keys.ozon.clientId, keys.ozon.apiKey, [
          {
            productId: parseInt(product.product_id.replace('ozon-', '')),
            price: newPrice,
          },
        ]);
        updateSuccess = res.success;
      }
    } catch (e) {
      console.error(`Smart Reprice failed for ${product.product_id}`, e);
    }

    if (updateSuccess) {
      summary.actionsTaken++;
      if (userResult) {
        userResult.actionsTaken++;
        userResult.defenseDetails.push({
          product: product.title,
          action: 'smart_reprice',
          marketplace,
          savedAmount: 0,
        });
      }
      await logSentinelAction({
        user_id: user.id,
        product_id: product.product_id,
        product_title: product.title,
        detected_price: livePrice,
        min_price: 0, // Not a protection action, so min_price is contextually different or irrelevant here
        defense_action: 'smart_reprice',
        saved_amount: 0,
        marketplace,
        threat_type: 'competitor_match',
        success: true,
        details,
      });
    }
  }

  private async notifyDefenseSuccess(
    user: DBUser,
    product: DBProduct,
    livePrice: number,
    minPrice: number,
    mode: string,
    marketplace: string
  ): Promise<void> {
    await sendAlert({
      type: 'price_protection',
      urgency: 'high',
      product: {
        name: product.title,
        marketplace,
        externalId: product.nm_id ? String(product.nm_id) : product.product_id,
        userId: user.id,
      },
      analysis: {
        currentPrice: livePrice,
        recommendedPrice: minPrice,
        reason: `Защита: ${mode === 'zero_stock' ? 'остаток→0' : 'цена↑'}`,
        action: mode,
      },
    });
  }
}
