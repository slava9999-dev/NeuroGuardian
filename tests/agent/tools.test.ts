// ============================================
// NeuroGUARDIAN — Agent Tools Tests
// Tests for AI agent tool definitions and execution
// ============================================

import { describe, it, expect } from 'vitest';

// Agent tools definitions (extracted from api/index.ts)
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description: 'Получить список товаров пользователя',
      parameters: {
        type: 'object',
        properties: {
          marketplace: { type: 'string', enum: ['WB', 'Ozon', 'all'] },
          limit: { type: 'number' },
          sort_by: { type: 'string', enum: ['price', 'stock', 'name'] },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_stop_loss',
      description: 'Установить минимальную цену (Stop-Loss)',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          min_price: { type: 'number' },
          percentage: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_prices',
      description: 'Изменить цены на товары',
      parameters: {
        type: 'object',
        properties: {
          product_ids: { type: 'array', items: { type: 'string' } },
          marketplace: { type: 'string', enum: ['WB', 'Ozon', 'all'] },
          price_change: { type: 'number' },
          price_change_percent: { type: 'number' },
        },
      },
    },
  },
];

// Tools that require confirmation
const CONFIRMATION_REQUIRED_TOOLS = ['set_stop_loss', 'bulk_protect_products', 'update_prices'];

describe('Agent Tools', () => {
  describe('Tool Definitions', () => {
    it('should have valid structure for all tools', () => {
      AGENT_TOOLS.forEach(tool => {
        expect(tool.type).toBe('function');
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
      });
    });

    it('should have get_products tool', () => {
      const getProducts = AGENT_TOOLS.find(t => t.function.name === 'get_products');
      expect(getProducts).toBeDefined();
      expect(getProducts?.function.parameters.properties).toHaveProperty('marketplace');
      expect(getProducts?.function.parameters.properties).toHaveProperty('limit');
    });

    it('should have set_stop_loss tool', () => {
      const setStopLoss = AGENT_TOOLS.find(t => t.function.name === 'set_stop_loss');
      expect(setStopLoss).toBeDefined();
      expect(setStopLoss?.function.parameters.properties).toHaveProperty('product_id');
      expect(setStopLoss?.function.parameters.properties).toHaveProperty('min_price');
    });

    it('should have update_prices tool', () => {
      const updatePrices = AGENT_TOOLS.find(t => t.function.name === 'update_prices');
      expect(updatePrices).toBeDefined();
      expect(updatePrices?.function.parameters.properties).toHaveProperty('product_ids');
      expect(updatePrices?.function.parameters.properties).toHaveProperty('price_change');
    });
  });

  describe('Confirmation Requirements', () => {
    it('should require confirmation for dangerous operations', () => {
      expect(CONFIRMATION_REQUIRED_TOOLS).toContain('set_stop_loss');
      expect(CONFIRMATION_REQUIRED_TOOLS).toContain('bulk_protect_products');
      expect(CONFIRMATION_REQUIRED_TOOLS).toContain('update_prices');
    });

    it('should not require confirmation for read operations', () => {
      expect(CONFIRMATION_REQUIRED_TOOLS).not.toContain('get_products');
      expect(CONFIRMATION_REQUIRED_TOOLS).not.toContain('get_sales_stats');
      expect(CONFIRMATION_REQUIRED_TOOLS).not.toContain('get_orders');
    });
  });
});

describe('Tool Argument Validation', () => {
  interface ProductsArgs {
    marketplace?: string;
    limit?: number | string;
    sort_by?: string;
  }

  const validateGetProductsArgs = (args: ProductsArgs) => {
    const { marketplace = 'all', limit = 20, sort_by = 'price' } = args;
    const validMarketplaces = ['WB', 'Ozon', 'all'];
    const validSortBy = ['price', 'stock', 'name'];

    return {
      marketplace: validMarketplaces.includes(marketplace) ? marketplace : 'all',
      limit: Math.min(Math.max(1, parseInt(String(limit)) || 20), 100),
      sort_by: validSortBy.includes(sort_by) ? sort_by : 'price',
    };
  };

  it('should sanitize marketplace parameter', () => {
    expect(validateGetProductsArgs({ marketplace: 'invalid' }).marketplace).toBe('all');
    expect(validateGetProductsArgs({ marketplace: 'WB' }).marketplace).toBe('WB');
    expect(validateGetProductsArgs({}).marketplace).toBe('all');
  });

  it('should clamp limit to valid range', () => {
    // 0 is falsy, so it defaults to 20, then clamped
    expect(validateGetProductsArgs({ limit: 0 }).limit).toBe(20);
    expect(validateGetProductsArgs({ limit: 1000 }).limit).toBe(100);
    expect(validateGetProductsArgs({ limit: 50 }).limit).toBe(50);
    expect(validateGetProductsArgs({ limit: 1 }).limit).toBe(1);
    // -5 parses to -5, Math.max(1, -5) = 1
    expect(validateGetProductsArgs({ limit: -5 }).limit).toBe(1);
  });

  it('should sanitize sort_by parameter', () => {
    expect(validateGetProductsArgs({ sort_by: 'invalid' }).sort_by).toBe('price');
    expect(validateGetProductsArgs({ sort_by: 'stock' }).sort_by).toBe('stock');
  });
});
