// Скрипт замены алертов в sentinel.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'api', 'handlers', 'sentinel.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Старый код (строки 647-666)
const oldCode = `  } else {
    // SUCCESS ALERT (срабатывание защиты)
    // NOTE: currentPrice is the DETECTED low price, minPrice is our stop-loss threshold
    // The "saved" amount shows what we protected against
    const priceDropText =
      data.currentPrice < data.minPrice
        ? \`📉 Обнаружено: <b>\${data.currentPrice}₽</b> (ниже минимума \${data.minPrice}₽)\`
        : \`📉 Цена: <b>\${data.currentPrice}₽</b> → защита: <b>\${data.minPrice}₽</b>\`;

    msg =
      \`🛡️ <b>NeuroGUARDIAN СТОРОЖ</b>\\\\n\\\\n\` +
      \`⚠️ <b>АТАКА ОБНАРУЖЕНА!</b>\\\\n\` +
      \`📅 \${date} в \${time}\\\\n\\\\n\` +
      \`\${marketplaceEmoji} <b>\${data.marketplace || 'Маркетплейс'}</b>\\\\n\` +
      \`📦 \${data.title}\\\\n\\\\n\` +
      \`\${priceDropText}\\\\n\` +
      \`⚔️ <b>Защита:</b> \${data.defenseAction}\\\\n\` +
      \`💰 <b>Спасено:</b> \${Math.abs(data.savedAmount)}₽\\\\n\\\\n\` +
      \`✅ Ваш товар защищён!\`;
  }`;

// Новый код
const newCode = `  } else {
    // SUCCESS ALERT - ГИБРИДНЫЙ ВАРИАНТ (Dec 2024)
    const wasBelow = data.currentPrice < data.minPrice;
    const difference = Math.abs(data.minPrice - data.currentPrice);
    
    // Короткое название (макс 60 символов)
    const shortTitle = data.title.length > 60 
      ? data.title.substring(0, 57) + '...' 
      : data.title;
    
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
        \`💸 <b>Было:</b> <s>\${data.currentPrice}₽</s> (на \${difference}₽ ниже)\\n\` +
        \`✅ <b>Стало:</b> \${data.minPrice}₽\`;
      resultBlock = \`💰 <b>Защитили:</b> \${difference}₽\`;
      tipBlock = \`💡 <i>Проверьте конкурентов</i>\`;
      
    } else if (difference === 0) {
      // СЦЕНАРИЙ 2: Превентивная защита — цена РАВНА минимуму
      headerEmoji = '✅';
      headerText = 'ЗАЩИТА СРАБОТАЛА';
      priceBlock = 
        \`💰 <b>Цена:</b> \${data.minPrice}₽\\n\` +
        \`🔒 <b>Статус:</b> Зафиксирована на минимуме\`;
      resultBlock = \`🛡️ <b>Результат:</b> Цена не упадёт ниже\`;
      tipBlock = \`💡 <i>Всё под контролем</i>\`;
      
    } else {
      // СЦЕНАРИЙ 3: Цена приближалась к минимуму
      headerEmoji = '⚠️';
      headerText = 'ЦЕНА ПРИБЛИЖАЛАСЬ К МИНИМУМУ';
      priceBlock = 
        \`📊 <b>Было:</b> \${data.currentPrice}₽\\n\` +
        \`🔒 <b>Защитили на:</b> \${data.minPrice}₽\`;
      resultBlock = \`🛡️ <b>Результат:</b> Снижение остановлено\`;
      tipBlock = \`💡 <i>Превентивная защита</i>\`;
    }

    // СБОРКА СООБЩЕНИЯ
    msg =
      \`🛡️ <b>СТОРОЖ</b>\\n\\n\` +
      \`\${headerEmoji} <b>\${headerText}</b>\\n\\n\` +
      \`\${marketplaceEmoji} \${data.marketplace || 'Маркетплейс'} • \${time}\\n\` +
      \`📦 \${shortTitle}\\n\\n\` +
      \`━━━━━━━━━━━━━━━━━━━━\\n\` +
      \`\${priceBlock}\\n\\n\` +
      \`⚔️ <b>Действие:</b> \${data.defenseAction}\\n\` +
      \`\${resultBlock}\\n\` +
      \`━━━━━━━━━━━━━━━━━━━━\\n\\n\` +
      \`✅ <b>Товар защищён!</b> \${tipBlock}\`;
  }`;

// Проверяем наличие старого кода
if (content.includes('SUCCESS ALERT (срабатывание защиты)')) {
  // Ищем и заменяем блок
  const startMarker = '  } else {\n    // SUCCESS ALERT (срабатывание защиты)';
  const endMarker = "✅ Ваш товар защищён!`;";
  
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx + endMarker.length);
    
    content = before + newCode + after;
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Файл успешно обновлен!');
    console.log(`📍 Изменены строки начиная с позиции ${startIdx}`);
  } else {
    console.log('❌ Не удалось найти границы блока');
    console.log(`Start: ${startIdx}, End: ${endIdx}`);
  }
} else {
  console.log('⚠️ Старый код не найден - возможно уже обновлен');
}
