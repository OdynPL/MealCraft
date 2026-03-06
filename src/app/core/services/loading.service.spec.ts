import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LoadingService } from './loading.service';

function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms);
}

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LoadingService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not be loading initially', () => {
    expect(service.isLoading()).toBe(false);
  });

  it('should set loading to true on start', () => {
    service.start();
    expect(service.isLoading()).toBe(true);
  });

  it('should keep loading true for multiple starts', () => {
    service.start();
    service.start();
    expect(service.isLoading()).toBe(true);
  });

  it('should not stop loading until all requests are stopped', () => {
    service.start();
    service.start();
    service.stop();
    expect(service.isLoading()).toBe(true);
    service.stop();
    // Should still be true due to minVisibleMs
    expect(service.isLoading()).toBe(true);
    advanceTime(500);
    expect(service.isLoading()).toBe(false);
  });

  it('should respect minVisibleMs', () => {
    service.start();
    service.stop();
    expect(service.isLoading()).toBe(true);
    advanceTime(499);
    expect(service.isLoading()).toBe(true);
    advanceTime(1);
    expect(service.isLoading()).toBe(false);
  });

  it('should reset timer if start is called during hide delay', () => {
    service.start();
    service.stop();
    advanceTime(300);
    service.start();
    expect(service.isLoading()).toBe(true);
    service.stop();
    advanceTime(200); // only 500ms since last start
    expect(service.isLoading()).toBe(true);
    advanceTime(300);
    expect(service.isLoading()).toBe(false);
  });

  it('should not go below zero pending requests', () => {
    service.stop();
    expect(service.isLoading()).toBe(false);
    service.start();
    service.stop();
    service.stop();
    advanceTime(500);
    expect(service.isLoading()).toBe(false);
  });
});
