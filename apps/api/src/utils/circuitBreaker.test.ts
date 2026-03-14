import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker, CircuitState } from "./circuitBreaker.js";

describe("CircuitBreaker", () => {
  it("should start in CLOSED state", () => {
    const cb = new CircuitBreaker("test");
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it("should open after failure threshold is reached", async () => {
    const cb = new CircuitBreaker("test", { failureThreshold: 2, resetTimeoutMs: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(cb.run(fn)).rejects.toThrow("fail");
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    await expect(cb.run(fn)).rejects.toThrow("fail");
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it("should stay open until reset timeout", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(cb.run(fn)).rejects.toThrow("fail");
    expect(cb.getState()).toBe(CircuitState.OPEN);

    // Call while open
    await expect(cb.run(fn)).rejects.toThrow("Circuit breaker test is open");

    // Advance time
    vi.advanceTimersByTime(1001);
    
    // Should be half-open on next run
    const successFn = vi.fn().mockResolvedValue("ok");
    const result = await cb.run(successFn);
    expect(result).toBe("ok");
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    
    vi.useRealTimers();
  });
});
