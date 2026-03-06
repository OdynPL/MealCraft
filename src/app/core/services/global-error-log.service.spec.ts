import { vi } from 'vitest';
import { GlobalErrorLogService, SystemError } from './global-error-log.service';

describe('GlobalErrorLogService', () => {
  let service: GlobalErrorLogService;
  let originalLocalStorage: Storage | undefined;
  let mockSetItem: ReturnType<typeof vi.fn>;
  let mockGetItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetItem = vi.fn();
    mockGetItem = vi.fn();
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem: mockSetItem, getItem: mockGetItem }
    });
    service = new GlobalErrorLogService();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage
    });
  });

  it('should log a system error and persist it', () => {
    const error: SystemError = {
      timestamp: new Date(),
      message: 'Test error',
      code: 500,
      context: 'TestContext',
      stack: 'stacktrace',
    };
    service.log(error);
    expect(service.errors[0].message).toBe('Test error');
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('should clear all errors and persist empty array', () => {
    service.clear();
    expect(service.errors.length).toBe(0);
    expect(mockSetItem).toHaveBeenCalledWith('system-errors', '[]');
  });

  it('should load errors from storage', () => {
    const now = new Date();
    const stored = JSON.stringify([
      { timestamp: now.toISOString(), message: 'err', code: 404 }
    ]);
    mockGetItem.mockReturnValue(stored);
    const loadedService = new GlobalErrorLogService();
    expect(loadedService.errors[0].message).toBe('err');
    expect(loadedService.errors[0].code).toBe(404);
  });
});
