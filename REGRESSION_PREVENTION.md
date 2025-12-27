# 🛡️ Система защиты от регрессий

## Проблема

После каждой сессии исправлений появляются новые баги или возвращаются старые проблемы.

## Решение: 4-уровневая защита

---

## 🎯 Уровень 1: Автоматические проверки (CI/CD)

### ✅ Что настроено:

- **GitHub Actions** (`.github/workflows/ci.yml`)
  - Lint + TypeScript проверка
  - Сборка проекта
  - Security audit
  - **Регрессионные тесты** (новое!)
  - Проверка bundle size
  - Сканирование секретов

### 📋 Регрессионные тесты проверяют:

1. ✅ Наличие критических файлов (`logger.ts`, `admin.ts`, etc.)
2. ✅ Отсутствие логирования API ключей
3. ✅ `.env` в `.gitignore`
4. ✅ Production guard в `handleResetDb`
5. ✅ Правильный экспорт логгера
6. ✅ Отсутствие хардкод-секретов в коде

### 🚀 Как это работает:

```bash
# При каждом push или PR автоматически запускается:
git push origin main
# → GitHub Actions проверяет все тесты
# → Если регрессия обнаружена → ❌ CI fails
# → Деплой блокируется до исправления
```

---

## 🔒 Уровень 2: Локальные pre-commit хуки

### ✅ Что настроено:

- **Husky** (`.husky/pre-commit`)
  - Lint-staged (автоформатирование)
  - **Регрессионные проверки** (новое!)

### 📋 Проверки перед коммитом:

1. ✅ Критические файлы существуют
2. ✅ Нет логирования API ключей
3. ✅ `.env` защищён

### 🚀 Как это работает:

```bash
git commit -m "fix: something"
# → Автоматически запускаются проверки
# → Если регрессия → ❌ коммит блокируется
# → Нужно исправить перед коммитом
```

---

## 📝 Уровень 3: Чек-листы для разработки

### Перед началом работы:

- [ ] Прочитать `AUDIT_FIXES_2025-12-28.md`
- [ ] Проверить актуальные TODO в `.agent/workflows/`
- [ ] Убедиться, что `main` ветка зелёная (CI passed)

### Во время разработки:

- [ ] Использовать `logger` вместо `console.log`
- [ ] Не хардкодить API ключи, пароли, токены
- [ ] Проверять TypeScript ошибки: `npm run build`
- [ ] Запускать тесты: `npm test`

### Перед коммитом:

- [ ] Проверить, что все файлы отформатированы
- [ ] Убедиться, что не удалены критические файлы
- [ ] Проверить, что `.env` не в git
- [ ] Запустить `npm run lint`

### Перед push:

- [ ] Проверить, что CI проходит локально
- [ ] Убедиться, что нет конфликтов с `main`
- [ ] Проверить, что bundle size не вырос

---

## 🧪 Уровень 4: Регрессионные тесты (unit/integration)

### ✅ Что нужно добавить:

#### 1. Тесты для критических исправлений

```typescript
// tests/regression/security-fixes.test.ts
describe('Security Fixes Regression Tests', () => {
  it('should not log API key length', () => {
    const adminCode = fs.readFileSync('api/handlers/admin.ts', 'utf-8');
    expect(adminCode).not.toMatch(/console\.log.*key.*length/);
  });

  it('should have .env in .gitignore', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it('should have production guard in handleResetDb', () => {
    const adminCode = fs.readFileSync('api/handlers/admin.ts', 'utf-8');
    expect(adminCode).toMatch(/isProduction/);
  });
});
```

#### 2. Тесты для логгера

```typescript
// tests/lib/logger.test.ts
import { logger } from '../../src/api-lib/lib/logger';

describe('Logger PII Redaction', () => {
  it('should redact API keys', () => {
    const spy = jest.spyOn(console, 'log');
    logger.info('Test', { api_key: 'sk-secret123456789' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('sk-s***[REDACTED]'));
  });

  it('should redact passwords', () => {
    const spy = jest.spyOn(console, 'log');
    logger.info('Test', { password: 'mypassword123' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('***[REDACTED]'));
  });
});
```

#### 3. Интеграционные тесты для API

```typescript
// tests/api/admin.test.ts
describe('Admin API', () => {
  it('should block handleResetDb in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .post('/api/admin')
      .send({ action: 'reset-db', confirm: 'RESET_ALL_DATA' })
      .set('x-admin-key', ADMIN_KEY);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('DISABLED in production');
  });
});
```

---

## 📊 Метрики качества

### Целевые показатели:

- ✅ **CI Success Rate:** ≥ 95%
- ✅ **Test Coverage:** ≥ 80%
- ✅ **Regression Tests:** 100% критических исправлений покрыты
- ✅ **Security Audit:** 0 high/critical CVE в production deps
- ✅ **Bundle Size:** < 500KB (gzipped)

### Мониторинг:

```bash
# Проверить статус CI
gh run list --limit 10

# Проверить покрытие тестами
npm run test:coverage

# Проверить уязвимости
npm audit --production

# Проверить размер бандла
npm run build && du -sh dist/
```

---

## 🚨 Что делать при обнаружении регрессии

### Если CI упал:

1. **Не игнорировать!** Это защита от багов
2. Прочитать лог ошибки в GitHub Actions
3. Воспроизвести локально: `npm run build && npm test`
4. Исправить проблему
5. Закоммитить исправление
6. Убедиться, что CI зелёный

### Если pre-commit блокирует:

1. Прочитать сообщение об ошибке
2. Исправить проблему (обычно это быстро)
3. Попробовать снова: `git commit`

### Если нашли баг в production:

1. Создать hotfix ветку: `git checkout -b hotfix/critical-bug`
2. Исправить проблему
3. **Добавить регрессионный тест** в CI
4. Создать PR с меткой `hotfix`
5. После мерджа - обновить документацию

---

## 📚 Дополнительные инструменты

### Рекомендуемые расширения VS Code:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Git hooks (опционально):

```bash
# Проверка перед push
cat > .husky/pre-push << 'EOF'
#!/usr/bin/env bash
npm run build
npm test
EOF

chmod +x .husky/pre-push
```

---

## 🎯 Итоговый чек-лист

### Защита настроена:

- [x] CI/CD с регрессионными тестами
- [x] Pre-commit хуки
- [x] Документация процесса
- [ ] Unit-тесты для критических исправлений (TODO: Фаза 5)
- [ ] Integration-тесты для API (TODO: Фаза 5)
- [ ] E2E-тесты для UI (TODO: Фаза 5)

### Следующие шаги:

1. **Сегодня:** Закоммитить изменения в CI и pre-commit
2. **Завтра:** Написать unit-тесты для `logger.ts`
3. **Неделя:** Добавить integration-тесты для API handlers
4. **Месяц:** Настроить E2E-тесты с Playwright

---

## 💡 Принципы работы

### Золотые правила:

1. **Никогда не игнорируй падающий CI** - это твоя страховка
2. **Каждое исправление = новый тест** - предотврати повторение
3. **Коммит часто, пуш редко** - локальные проверки дешевле CI
4. **Документируй критические изменения** - будущий ты скажет спасибо

### Если что-то мешает:

- **CI слишком медленный?** Оптимизируй, но не отключай
- **Pre-commit раздражает?** Исправь код, а не хук
- **Тесты флакают?** Исправь тесты, не удаляй их

---

## 📞 Помощь

**Вопросы по CI:** см. `.github/workflows/ci.yml`  
**Вопросы по pre-commit:** см. `.husky/pre-commit`  
**Вопросы по тестам:** см. `tests/README.md` (TODO)

**Нашли баг в защите?** Создай issue с меткой `ci/cd`
