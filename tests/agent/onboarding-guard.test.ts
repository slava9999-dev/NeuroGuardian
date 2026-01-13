import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAgentV4 } from '../../src/api-lib/handlers/agent-v4';
import { getUserById } from '../../src/api-lib/services/index';

// 1. Mock Database/Services
vi.mock('../../src/api-lib/services/index', () => ({
  getUserById: vi.fn(),
  getProductsByUserId: vi.fn().mockResolvedValue([]),
}));

// 2. Mock Lib (Auth, RateLimit)
vi.mock('../../src/api-lib/lib/index', () => ({
  sanitizeInput: (s: any) => s,
  decryptApiKey: (k: any) => k,
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  isSubscriptionActive: vi.fn().mockReturnValue(true),
  getSecret: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 3. Mock Middleware
vi.mock('../../src/api-lib/middleware/auth', () => ({
  verifyAdminAccessAsync: vi.fn().mockResolvedValue(false),
  extractTelegramAuth: vi.fn().mockReturnValue({
    success: true,
    context: {
      userId: 12345,
      username: 'test',
    },
  }),
}));

// 4. Mock Orchestrator
vi.mock('../../src/api-lib/agent/orchestrator-v4', () => ({
  orchestrateV4: vi.fn().mockResolvedValue({ success: true, message: 'Orchestrated Response' }),
}));

// 5. Mock Security Agent
vi.mock('@neuroguardian/security-agent', () => ({
  getSecurityAgent: vi.fn().mockReturnValue({}),
  securityMiddleware: vi.fn().mockImplementation((_opts, handler) => {
    return async (req: any, res: any) => {
      return handler(req, res);
    };
  }),
}));

// 6. Mock Metrics
vi.mock('../../src/api-lib/agent/metrics', () => ({
  createAgentMetrics: vi.fn(),
  logAgentMetrics: vi.fn().mockResolvedValue(true),
  formatMetricsForLog: vi.fn(),
}));

// 7. Mock KV
vi.mock('@vercel/kv', () => ({
  createClient: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

describe('Agent V4 Onboarding Guard', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: 'POST', // Handler checks for POST
      body: {
        message: 'Analyze my sales',
      },
      headers: {
        'x-telegram-auth': 'some-auth-string',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('should return onboarding message when user has NO keys', async () => {
    // Mock user without keys
    vi.mocked(getUserById).mockResolvedValue({
      id: 12345,
      first_name: 'Test',
      subscription_active: true,
      api_key_wb: null,
      api_key_ozon: null,
    } as any);

    await handleAgentV4(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const response = res.json.mock.calls[0][0];

    // Critical checks
    expect(response.message).toContain('Orchestrated Response');
    // Connection actions are injected by the handler
    expect(response.actions).toHaveLength(2); // WB and Ozon connection actions
    expect(response.actions[0].type).toBe('navigation');
  });

  it('should ALLOW flow when user HAS keys', async () => {
    // Mock user WITH keys
    vi.mocked(getUserById).mockResolvedValue({
      id: 12345,
      first_name: 'Test',
      subscription_active: true,
      api_key_wb: 'encrypted_wb_key',
      api_key_ozon: null,
    } as any);

    const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4');

    await handleAgentV4(req, res);

    expect(orchestrateV4).toHaveBeenCalled();
  });

  it('should ALLOW help intent even without keys', async () => {
    // Mock user without keys
    vi.mocked(getUserById).mockResolvedValue({
      id: 12345,
      first_name: 'Test',
      subscription_active: true,
      api_key_wb: null,
      api_key_ozon: null,
    } as any);

    req.body.message = 'Помощь'; // Special intent

    const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4');

    await handleAgentV4(req, res);

    expect(orchestrateV4).toHaveBeenCalled();
  });
});
