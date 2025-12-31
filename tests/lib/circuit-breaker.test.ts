// ============================================
// NeuroGUARDIAN — Circuit Breaker Tests
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerPresets,
  CircuitOpenError,
  circuitBreakers,
  withCircuitBreaker,
} from '../../src/api-lib/lib/circuit-breaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // Create a fresh breaker for each test with small values for fast tests
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 2,
      resetTimeoutMs: 100,
      successThreshold: 1,
      callTimeoutMs: 1000,
    });
  });

  describe('CLOSED state', () => {
    it('should execute function successfully in closed state', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should propagate errors but not open circuit immediately', async () => {
      await expect(breaker.execute(() => Promise.reject(new Error('test error')))).rejects.toThrow(
        'test error'
      );

      // Circuit should still be closed after 1 failure
      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(1);
    });

    it('should open circuit after reaching failure threshold', async () => {
      // First failure
      await expect(breaker.execute(() => Promise.reject(new Error('error 1')))).rejects.toThrow();

      // Second failure - should open circuit
      await expect(breaker.execute(() => Promise.reject(new Error('error 2')))).rejects.toThrow();

      // Circuit should now be open
      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
    });

    it('should throw CircuitOpenError when circuit is open', async () => {
      await expect(breaker.execute(() => Promise.resolve('success'))).rejects.toThrow(
        CircuitOpenError
      );
    });

    it('should include retry info in CircuitOpenError', async () => {
      try {
        await breaker.execute(() => Promise.resolve('success'));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        const cbError = error as CircuitOpenError;
        expect(cbError.serviceName).toBe('test-service');
        expect(cbError.retryAfterMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should transition to half-open after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to half-open and attempt
      const result = await breaker.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED'); // Successful call in half-open closes circuit
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      // Wait for reset timeout to transition to half-open
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should close circuit on successful call in half-open state', async () => {
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });

    it('should reopen circuit on failure in half-open state', async () => {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
    });
  });

  describe('executeWithFallback', () => {
    it('should use fallback when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      const result = await breaker.executeWithFallback(
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('fallback');
    });

    it('should not use fallback when circuit is closed', async () => {
      const result = await breaker.executeWithFallback(
        () => Promise.resolve('primary'),
        () => Promise.resolve('fallback')
      );

      expect(result).toBe('primary');
    });
  });

  describe('forceReset', () => {
    it('should reset circuit to closed state', async () => {
      // Open the circuit
      for (let i = 0; i < 2; i++) {
        await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(breaker.getStatus().state).toBe('OPEN');

      breaker.forceReset();

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    circuitBreakers.resetAll();
  });

  it('should create circuit breaker for new service', () => {
    const breaker = circuitBreakers.get('new-test-service');
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('should return same breaker for same service name', () => {
    const breaker1 = circuitBreakers.get('same-service');
    const breaker2 = circuitBreakers.get('same-service');
    expect(breaker1).toBe(breaker2);
  });

  it('should apply WB preset for wb service', () => {
    const breaker = circuitBreakers.get('wb-content-api');
    const status = breaker.getStatus();
    expect(status.name).toBe('wb-content-api');
  });

  it('should getAllStatus return all breakers', () => {
    circuitBreakers.get('service-1');
    circuitBreakers.get('service-2');

    const statuses = circuitBreakers.getAllStatus();
    expect(statuses.length).toBeGreaterThanOrEqual(2);
  });
});

describe('withCircuitBreaker helper', () => {
  beforeEach(() => {
    circuitBreakers.resetAll();
  });

  it('should execute function through circuit breaker', async () => {
    const result = await withCircuitBreaker('helper-test', () => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('should use fallback when provided and circuit opens', async () => {
    const serviceName = 'helper-fallback-test';

    // Open the circuit by causing failures
    for (let i = 0; i < 5; i++) {
      await withCircuitBreaker(serviceName, () => Promise.reject(new Error('fail'))).catch(
        () => {}
      );
    }

    // Now circuit should be open, fallback should be used
    const result = await withCircuitBreaker(
      serviceName,
      () => Promise.resolve('primary'),
      () => Promise.resolve('fallback')
    );

    expect(result).toBe('fallback');
  });
});

describe('CircuitBreakerPresets', () => {
  it('should have all required presets', () => {
    expect(CircuitBreakerPresets.MARKETPLACE_API).toBeDefined();
    expect(CircuitBreakerPresets.LLM_API).toBeDefined();
    expect(CircuitBreakerPresets.LOCAL_SERVICE).toBeDefined();
    expect(CircuitBreakerPresets.DATABASE).toBeDefined();
  });

  it('should have valid config values', () => {
    expect(CircuitBreakerPresets.MARKETPLACE_API.failureThreshold).toBeGreaterThan(0);
    expect(CircuitBreakerPresets.LLM_API.resetTimeoutMs).toBeGreaterThan(0);
    expect(CircuitBreakerPresets.DATABASE.successThreshold).toBeGreaterThan(0);
  });
});
