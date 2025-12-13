// ============================================
// NeuroGUARDIAN — Defense Protocol
// Actions when price drops below minPrice
// ============================================

import { ProductDoc, DefenseActionResult, DefenseMode, Marketplace } from '../../schemas';
import { zeroWBStock, updateWBPrice } from '../sync/wbFetcher';
import { zeroOzonStock, updateOzonPrice } from '../sync/ozonFetcher';
import { updateProductStatus, addLogEntry, updateUserStats, getUser } from '../../lib/firestore';
import { sendTelegramAlert } from './alerting';

interface DefenseContext {
  userId: number;
  product: ProductDoc;
  currentPrice: number;
  minPrice: number;
  defenseMode: DefenseMode;
  wbApiKey?: string;
  ozonApiKey?: string;
  ozonClientId?: string;
}

/**
 * Execute defense protocol for a single product
 */
export async function executeDefense(ctx: DefenseContext): Promise<DefenseActionResult> {
  const { userId, product, currentPrice, minPrice, defenseMode } = ctx;
  
  console.log(`Executing defense for product ${product.productId}: ${currentPrice} < ${minPrice}`);
  
  const savedAmount = minPrice - currentPrice;
  
  try {
    let success = false;
    let action: DefenseActionResult['action'] = 'none';
    let newStock: number | undefined;
    let newPrice: number | undefined;
    
    if (defenseMode === 'zero_stock') {
      // Mode 1: Zero out stock
      success = await executeZeroStock(ctx);
      action = 'zero_stock';
      newStock = 0;
    } else {
      // Mode 2: Correct price back to minPrice
      success = await executePriceCorrection(ctx);
      action = 'price_correction';
      newPrice = minPrice;
    }
    
    if (success) {
      // Update product status
      await updateProductStatus(userId, product.productId, 'triggered', {
        lastTriggeredAt: new Date(),
        currentPrice: newPrice ?? currentPrice,
        stock: newStock ?? product.stock,
      });
      
      // Update user stats
      const user = await getUser(userId);
      if (user) {
        await updateUserStats(userId, {
          triggeredToday: (user.triggeredToday || 0) + 1,
          savedAmount: (user.savedAmount || 0) + savedAmount,
        });
      }
      
      // Add log entry
      await addLogEntry(
        userId,
        'defense_triggered',
        `🛡️ Защита сработала!`,
        `Товар "${product.title}" защищён. ${defenseMode === 'zero_stock' ? 'Сток обнулён.' : `Цена восстановлена до ${minPrice}₽.`}`,
        {
          oldPrice: currentPrice,
          newPrice: newPrice ?? currentPrice,
          minPrice,
          savedAmount,
          action,
          marketplace: product.marketplace,
        },
        product.productId
      );
      
      // Send Telegram notification
      await sendTelegramAlert(userId, {
        type: 'defense_triggered',
        productTitle: product.title,
        vendorCode: product.vendorCode,
        oldPrice: currentPrice,
        minPrice,
        action,
        savedAmount,
        marketplace: product.marketplace,
      });
      
      return {
        success: true,
        action,
        productId: product.productId,
        marketplace: product.marketplace,
        oldPrice: currentPrice,
        newPrice,
        oldStock: product.stock,
        newStock,
        message: `Defense executed: ${action}`,
      };
    } else {
      throw new Error('Defense action failed');
    }
  } catch (error: any) {
    console.error(`Defense failed for product ${product.productId}:`, error);
    
    // Log the error
    await addLogEntry(
      userId,
      'error',
      '❌ Ошибка защиты',
      `Не удалось защитить товар "${product.title}": ${error.message}`,
      {
        error: error.message,
        productId: product.productId,
        marketplace: product.marketplace,
      },
      product.productId
    );
    
    return {
      success: false,
      action: 'none',
      productId: product.productId,
      marketplace: product.marketplace,
      oldPrice: currentPrice,
      message: `Defense failed: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Execute zero stock action
 */
async function executeZeroStock(ctx: DefenseContext): Promise<boolean> {
  const { product, wbApiKey, ozonApiKey, ozonClientId } = ctx;
  
  if (product.marketplace === 'WB') {
    if (!wbApiKey) {
      throw new Error('WB API key not available');
    }
    
    // Get SKUs from product (need to fetch or store them)
    // For now, using vendorCode as SKU
    const skus = [product.vendorCode];
    const warehouseId = 1; // TODO: Get actual warehouse ID
    
    return zeroWBStock(
      { apiKey: wbApiKey, maxRetries: 3 },
      skus,
      warehouseId
    );
  } else if (product.marketplace === 'Ozon') {
    if (!ozonApiKey || !ozonClientId) {
      throw new Error('Ozon API credentials not available');
    }
    
    const productId = parseInt(product.productId.replace('ozon-', ''), 10);
    const warehouseId = 1; // TODO: Get actual warehouse ID
    
    return zeroOzonStock(
      { apiKey: ozonApiKey, clientId: ozonClientId, maxRetries: 3 },
      [{ product_id: productId, offer_id: product.offerId || '' }],
      warehouseId
    );
  }
  
  return false;
}

/**
 * Execute price correction action
 */
async function executePriceCorrection(ctx: DefenseContext): Promise<boolean> {
  const { product, minPrice, wbApiKey, ozonApiKey, ozonClientId } = ctx;
  
  if (product.marketplace === 'WB') {
    if (!wbApiKey) {
      throw new Error('WB API key not available');
    }
    
    const nmId = product.nmId;
    if (!nmId) {
      throw new Error('WB nmId not available');
    }
    
    return updateWBPrice(
      { apiKey: wbApiKey, maxRetries: 3 },
      nmId,
      minPrice
    );
  } else if (product.marketplace === 'Ozon') {
    if (!ozonApiKey || !ozonClientId) {
      throw new Error('Ozon API credentials not available');
    }
    
    const productId = parseInt(product.productId.replace('ozon-', ''), 10);
    
    return updateOzonPrice(
      { apiKey: ozonApiKey, clientId: ozonClientId, maxRetries: 3 },
      productId,
      product.offerId || '',
      minPrice
    );
  }
  
  return false;
}

/**
 * Check if defense should trigger for a product
 */
export function shouldTriggerDefense(
  currentPrice: number,
  minPrice: number
): boolean {
  // Only trigger if minPrice is set (> 0) and current price is below it
  return minPrice > 0 && currentPrice < minPrice;
}

/**
 * Calculate potential savings
 */
export function calculateSavings(
  currentPrice: number,
  minPrice: number,
  stock: number
): number {
  if (currentPrice >= minPrice) return 0;
  return (minPrice - currentPrice) * stock;
}
