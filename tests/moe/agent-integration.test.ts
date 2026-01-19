import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAgentV4Status } from '../../src/api-lib/handlers/agent-v4.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock dependencies
vi.mock('../../src/api-lib/lib/index.js', () => ({
  sanitizeInput: (input: unknown) => input,
  decryptApiKey: (key: string) => `decrypted_${key}`,
  checkRateLimit: vi.fn(),
  isSubscriptionActive: vi.fn(),
  getSecret: vi.fn(),
}));

describe('Agent V4 Handler - MoE Integration', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let statusMock: any;

  beforeEach(() => {
    process.env.MOE_ROUTING_ENABLED = 'true';
    process.env.FORCE_LOCAL_INFERENCE = 'false';

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      method: 'GET',
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('should include MoE status in agent status response', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleAgentV4Status(req as any, res as any);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        available: true,
        version: 'v4',
        moe: expect.objectContaining({
          enabled: true,
          forceLocal: false,
          description: 'Hybrid MoE: Local LLM → Cloud → Rule-based fallback',
        }),
      })
    );
  });

  it('should reflect disabled MoE status', async () => {
    process.env.MOE_ROUTING_ENABLED = 'false';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleAgentV4Status(req as any, res as any);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moe: expect.objectContaining({
          enabled: false,
          description: 'MoE routing disabled, using cloud LLM only',
        }),
      })
    );
  });

  it('should reflect force local config', async () => {
    process.env.FORCE_LOCAL_INFERENCE = 'true';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleAgentV4Status(req as any, res as any);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        moe: expect.objectContaining({
          forceLocal: true,
        }),
      })
    );
  });
});
