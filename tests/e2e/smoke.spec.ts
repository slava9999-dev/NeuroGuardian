import { test, expect } from '@playwright/test';

test.describe('NeuroAgent Smoke Tests', () => {
  test('should load the agent page and show welcome message', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible({
      timeout: 15000,
    });

    // 4. Verify Welcome Screen for Demo User
    await expect(page.locator('text=Привет,')).toBeVisible();
    await expect(page.locator('text=Demo User')).toBeVisible();

    // 5. Check Quick Action Buttons (using specify roles/text to avoid ambiguity)
    await expect(page.getByRole('button', { name: '📦 Товары' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📊 Продажи' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🛡️ Защита' })).toBeVisible();
    await expect(page.getByRole('button', { name: '💰 Экономика' })).toBeVisible();
  });

  test('should navigate to products page and see mock products', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible();

    // Click 'Товары' tab at the bottom - use specific selector for the nav
    const productsTab = page.locator('nav button:has-text("Товары")');
    await productsTab.click();

    // Verify products page title
    await expect(page.locator('h1:has-text("Товары")').first()).toBeVisible();

    // Verify mock products are visible
    await expect(page.locator('text=Кроссовки Nike Air Max 270')).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible();

    // Click 'Настройки' tab
    const settingsTab = page.locator('nav button:has-text("Настройки")');
    await settingsTab.click();

    // Verify settings page elements
    await expect(page.locator('h1:has-text("Настройки")')).toBeVisible();
    await expect(page.locator('text=Подключённые API')).toBeVisible();
    await expect(page.locator('text=Пробный период')).toBeVisible();
  });

  test('should perform a simple interaction with the agent', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible();

    // Type a message
    const textarea = page.locator('textarea[placeholder="Сообщение..."]');
    await textarea.fill('Привет, как дела?');

    // Click send - find send button by characteristic (it has a polygon in SVG)
    const sendButton = page.locator('button:has(svg polygon)');
    await sendButton.click();

    // Check if user message is added
    await expect(page.locator('text=Привет, как дела?')).toBeVisible();
  });
});
