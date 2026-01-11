import { test, expect } from '@playwright/test';

test.describe('NeuroAgent Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable request logging for debugging
    page.on('request', request => console.log('>>', request.method(), request.url()));
    page.on('response', response => console.log('<<', response.status(), response.url()));

    // Mock ALL potential API calls to ensure lightning-fast transition to ready state

    // 1. Products API
    await page.route(
      url => url.href.includes('action=products'),
      async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              products: [
                {
                  id: 'prod-1',
                  productId: 'prod-1',
                  userId: 7548070478,
                  title: 'Кроссовки Nike Air Max 270',
                  vendorCode: '12345678',
                  marketplace: 'WB',
                  currentPrice: 12500,
                  minPrice: 11000,
                  stock: 15,
                  status: 'protected',
                  imageUrl: '',
                  isMonitored: true,
                  lastCheckedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        } else {
          await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        }
      }
    );

    // 2. Chat history
    await page.route(
      url => url.href.includes('action=get-chat-history'),
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, messages: [] }),
        });
      }
    );

    // 3. Agent V4 Chat interaction
    await page.route(
      url => url.href.includes('action=agent-v4'),
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Привет! Я тестовый помощник.',
          }),
        });
      }
    );

    // 4. Default /api fallback for auth and other POSTs
    await page.route(
      url => url.pathname === '/api',
      async route => {
        const method = route.request().method();
        const url = new URL(route.request().url());
        const action = url.searchParams.get('action');

        if (method === 'POST') {
          const body = route.request().postDataJSON() || {};

          // Auth call
          if (body.action === 'auth' || action === 'auth') {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                user: {
                  firstName: 'Developer',
                  username: 'slava9999',
                  subscriptionActive: true,
                  subscriptionPlan: 'pro',
                  savedAmount: 0,
                },
              }),
            });
          }
        }

        // Mock marketplace-accounts if requested
        if (action === 'marketplace-accounts') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, accounts: [] }),
          });
        }

        // General successful response for other actions
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    );
  });

  test('should load the agent page and show welcome message', async ({ page }) => {
    await page.goto('/');

    // Wait for the loading screen to disappear
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible({
      timeout: 20000,
    });

    // Verify Welcome Screen for Developer
    await expect(page.locator('text=Привет,').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Developer').first()).toBeVisible();
  });

  test('should navigate to products page and see mock products', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible({
      timeout: 20000,
    });

    // Click 'Товары' tab using role for robustness
    await page.getByRole('button', { name: 'Товары', exact: true }).click();

    // Verify h1 "Товары"
    await expect(page.locator('h1').filter({ hasText: 'Товары' })).toBeVisible({ timeout: 15000 });

    // Verify mock products are visible
    await expect(page.getByText('Кроссовки Nike Air Max 270').first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible({
      timeout: 20000,
    });

    // Click 'Настройки' tab using role
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();

    // Wait for settings page to render
    await expect(page.locator('h1').filter({ hasText: 'Настройки' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('Аккаунты Маркетплейсов').first()).toBeVisible({ timeout: 15000 });
  });

  test('should perform a simple interaction with the agent', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Загрузка вашего помощника...')).not.toBeVisible({
      timeout: 20000,
    });

    // Ensure state is ready
    await expect(page.locator('text=Привет,').first()).toBeVisible({ timeout: 15000 });

    // Type a message
    const textarea = page.locator('textarea[placeholder*="Сообщение"]');
    await textarea.fill('Привет, как дела?');

    // Click send - find send button by class
    const sendButton = page.locator('button.bg-violet-600');
    await sendButton.click();

    // Wait for processing to stop (Online status appears)
    await expect(page.locator('text=Online')).toBeVisible({ timeout: 15000 });

    // Check if user message is added
    await expect(page.getByText('Привет, как дела?').first()).toBeVisible({ timeout: 15000 });

    // Check if assistant (mocked) reply appeared
    await expect(page.getByText('Привет! Я тестовый помощник.').first()).toBeVisible({
      timeout: 15000,
    });
  });
});
