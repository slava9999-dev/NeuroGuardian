# ============================================
# NeuroGUARDIAN — Database Reset Script
# Для чистого тестирования
# ============================================

# ВАЖНО: Замените YOUR_ADMIN_KEY на ваш настоящий ключ из Vercel
$ADMIN_KEY = Read-Host -Prompt "Введите ваш ADMIN_API_KEY из Vercel"

$baseUrl = "https://neuro-guardian.vercel.app/api"

Write-Host "`n🔍 Проверяем текущих пользователей..." -ForegroundColor Cyan
$users = Invoke-RestMethod -Uri "$baseUrl`?action=admin-list-users" -Method Get -Headers @{"X-Admin-Key"=$ADMIN_KEY}
Write-Host "Найдено пользователей: $($users.count)" -ForegroundColor Yellow

if ($users.count -gt 0) {
    Write-Host "`n📋 Список пользователей:" -ForegroundColor Cyan
    $users.users | ForEach-Object {
        Write-Host "  - ID: $($_.id), Name: $($_.firstName), Plan: $($_.plan)" -ForegroundColor Gray
    }
    
    Write-Host "`n⚠️  ВНИМАНИЕ: Все пользователи и их товары будут удалены!" -ForegroundColor Red
    $confirm = Read-Host "Продолжить? (yes/no)"
    
    if ($confirm -eq "yes") {
        Write-Host "`n🗑️  Удаляем данные..." -ForegroundColor Yellow
        
        # Для каждого пользователя удаляем через API (если есть такой endpoint)
        # Или используем init-db для сброса
        
        # Вызываем init-db для пересоздания таблиц
        $body = @{action="init-db"} | ConvertTo-Json
        $result = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers @{"X-Admin-Key"=$ADMIN_KEY; "Content-Type"="application/json"} -Body $body
        Write-Host "✅ База данных пересоздана: $($result.message)" -ForegroundColor Green
        
        Write-Host "`n📋 Проверяем после очистки..." -ForegroundColor Cyan
        $usersAfter = Invoke-RestMethod -Uri "$baseUrl`?action=admin-list-users" -Method Get -Headers @{"X-Admin-Key"=$ADMIN_KEY}
        Write-Host "Пользователей осталось: $($usersAfter.count)" -ForegroundColor Green
    } else {
        Write-Host "Отменено." -ForegroundColor Yellow
    }
} else {
    Write-Host "База уже пустая!" -ForegroundColor Green
}

Write-Host "`n✅ Готово! Теперь войдите в приложение через Telegram для создания нового пользователя с 3-дневным trial." -ForegroundColor Green
