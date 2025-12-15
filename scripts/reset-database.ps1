# ============================================
# NeuroGUARDIAN — Database Reset Script
# Для чистого тестирования
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   NeuroGUARDIAN - Database Reset Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Запрос ключа безопасно
$ADMIN_KEY = Read-Host -Prompt "`n🔑 Введите ваш ADMIN_API_KEY из Vercel"

if ([string]::IsNullOrEmpty($ADMIN_KEY)) {
    Write-Host "❌ Ключ не введён. Отмена." -ForegroundColor Red
    exit 1
}

$baseUrl = "https://neuro-guardian.vercel.app/api"

Write-Host "`n🔍 Проверяем текущих пользователей..." -ForegroundColor Cyan

try {
    $users = Invoke-RestMethod -Uri "$baseUrl`?action=admin-list-users" -Method Get -Headers @{"X-Admin-Key" = $ADMIN_KEY }
    Write-Host "✅ Найдено пользователей: $($users.count)" -ForegroundColor Yellow

    if ($users.count -gt 0) {
        Write-Host "`n📋 Список пользователей:" -ForegroundColor Cyan
        $users.users | ForEach-Object {
            Write-Host "  - ID: $($_.id), Name: $($_.firstName), Plan: $($_.plan)" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n⚠️  ВНИМАНИЕ: Все пользователи, товары и транзакции будут УДАЛЕНЫ!" -ForegroundColor Red
    $confirm = Read-Host "Продолжить? (yes/no)"
    
    if ($confirm -eq "yes") {
        Write-Host "`n🗑️  Очищаем базу данных..." -ForegroundColor Yellow
        
        $body = @{action = "reset-db" } | ConvertTo-Json
        $result = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers @{"X-Admin-Key" = $ADMIN_KEY; "Content-Type" = "application/json" } -Body $body
        
        Write-Host "`n✅ База данных очищена!" -ForegroundColor Green
        Write-Host "   Удалено пользователей: $($result.deleted.users)" -ForegroundColor Gray
        Write-Host "   Удалено товаров: $($result.deleted.products)" -ForegroundColor Gray
        
        Write-Host "`n📋 Проверяем после очистки..." -ForegroundColor Cyan
        $usersAfter = Invoke-RestMethod -Uri "$baseUrl`?action=admin-list-users" -Method Get -Headers @{"X-Admin-Key" = $ADMIN_KEY }
        Write-Host "✅ Пользователей в базе: $($usersAfter.count)" -ForegroundColor Green
        
        Write-Host "`n" -ForegroundColor White
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "   ГОТОВО К ТЕСТИРОВАНИЮ!" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "`n📱 Следующие шаги:" -ForegroundColor Cyan
        Write-Host "   1. Откройте @NeuroGuardianBot в Telegram" -ForegroundColor White
        Write-Host "   2. Нажмите 'Открыть приложение'" -ForegroundColor White
        Write-Host "   3. Вы получите автоматический 3-дневный Trial" -ForegroundColor White
        Write-Host "   4. Введите Ozon API ключ и синхронизируйте товары" -ForegroundColor White
        Write-Host "   5. Установите Stop-Loss и включите защиту" -ForegroundColor White
        Write-Host "`n"
        
    }
    else {
        Write-Host "❌ Отменено." -ForegroundColor Yellow
    }
    
}
catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Проверьте что ADMIN_API_KEY правильный и Vercel задеплоен." -ForegroundColor Gray
}
