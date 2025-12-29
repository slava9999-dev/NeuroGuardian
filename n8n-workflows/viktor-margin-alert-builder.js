/**
 * Viktor Margin v3.0 - Enhanced Sentinel Alert Builder
 * 
 * This code replaces the "Build Summary Message" node in sentinel-workflow.json
 * 
 * Features:
 * - Viktor Margin persona style
 * - Detailed margin breakdown
 * - Concrete numbers and annual impact
 * - Threat severity indicators
 * - Actionable recommendations
 */

const items = $input.all();

let criticalCount = 0;
let successCount = 0;
let errorCount = 0;
const criticalThreats = [];
const successActions = [];
const errorActions = [];

for (const item of items) {
  const status = item.json.execution_status;
  const marketplace = item.json.marketplace || 'unknown';
  const productTitle = item.json.product_title || item.json.product_id || 'Unknown Product';
  const productId = item.json.product_id || item.json.offer_id || 'unknown';
  const action = item.json.defense_action || 'unknown';
  const detectedPrice = item.json.detected_price || 0;
  const minPrice = item.json.min_price || 0;
  const savedAmount = item.json.saved_amount || 0;
  
  // Emoji for marketplace
  const mpEmoji = marketplace.toLowerCase() === 'wildberries' || marketplace.toLowerCase() === 'wb' ? '🟣' : '🔵';
  
  if (status === 'success') {
    successCount++;
    
    // Calculate impact
    const priceDropPercent = minPrice > 0 ? ((minPrice - detectedPrice) / minPrice * 100).toFixed(1) : 0;
    const annualImpact = savedAmount * 1000; // Impact on 1000 orders
    
    const actionText = action === 'zero_stock' 
      ? '🛡️ Обнулены остатки' 
      : `🛡️ Цена возвращена к ${minPrice}₽`;
    
    successActions.push({
      title: productTitle,
      marketplace: marketplace,
      mpEmoji: mpEmoji,
      detectedPrice: detectedPrice,
      minPrice: minPrice,
      savedAmount: savedAmount,
      priceDropPercent: priceDropPercent,
      annualImpact: annualImpact,
      action: actionText
    });
    
    // Check if critical (price drop > 10% or negative margin)
    if (priceDropPercent > 10 || detectedPrice < minPrice * 0.9) {
      criticalCount++;
    }
  } else {
    errorCount++;
    const errorReason = item.json.error_reason || 'Unknown error';
    errorActions.push({
      title: productTitle,
      marketplace: marketplace,
      mpEmoji: mpEmoji,
      productId: productId,
      error: errorReason
    });
  }
}

// Build Viktor Margin style message
let message = '';

// Header
if (criticalCount > 0) {
  message += `🚨 *КРИТИЧЕСКАЯ УГРОЗА МАРЖИ!*\n\n`;
} else if (successCount > 0) {
  message += `🛡️ *VIKTOR MARGIN: Защита сработала!*\n\n`;
} else {
  message += `✅ *VIKTOR MARGIN: Мониторинг*\n\n`;
}

// Summary stats
message += `📊 *СТАТИСТИКА:*\n`;
message += `✅ Защищено: ${successCount}\n`;
if (criticalCount > 0) {
  message += `🚨 Критических: ${criticalCount}\n`;
}
if (errorCount > 0) {
  message += `❌ Ошибок: ${errorCount}\n`;
}
message += `📦 Всего обработано: ${items.length}\n\n`;

// Detailed breakdown for successful actions
if (successActions.length > 0) {
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*ЗАЩИЩЁННЫЕ ТОВАРЫ:*\n\n`;
  
  successActions.forEach((item, index) => {
    if (index < 5) { // Limit to 5 items to avoid message too long
      message += `${item.mpEmoji} *${item.title}*\n`;
      message += `├─ Обнаружена цена: ${item.detectedPrice}₽\n`;
      message += `├─ Лимит (Stop-Loss): ${item.minPrice}₽\n`;
      message += `├─ Падение: ${item.priceDropPercent}%\n`;
      message += `├─ Сохранено: ${item.savedAmount}₽ на заказ\n`;
      message += `├─ Годовой impact: ${item.annualImpact.toFixed(0)}₽ (на 1000 заказов)\n`;
      message += `└─ ${item.action}\n\n`;
    }
  });
  
  if (successActions.length > 5) {
    message += `_...и ещё ${successActions.length - 5} товаров_\n\n`;
  }
}

// Error details
if (errorActions.length > 0) {
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `⚠️ *ТРЕБУЕТСЯ ВНИМАНИЕ:*\n\n`;
  
  errorActions.forEach((item, index) => {
    if (index < 3) { // Limit to 3 errors
      message += `${item.mpEmoji} ${item.title}\n`;
      message += `└─ Ошибка: ${item.error}\n\n`;
    }
  });
  
  if (errorActions.length > 3) {
    message += `_...и ещё ${errorActions.length - 3} ошибок_\n\n`;
  }
}

// Footer with Viktor Margin signature
message += `━━━━━━━━━━━━━━━━━━━━\n`;
message += `💡 *Viktor Margin*\n`;
message += `_Защита вашей маржи 24/7_`;

return {
  json: {
    message: message,
    successCount: successCount,
    criticalCount: criticalCount,
    errorCount: errorCount,
    totalProcessed: items.length,
    hasCritical: criticalCount > 0
  }
};
