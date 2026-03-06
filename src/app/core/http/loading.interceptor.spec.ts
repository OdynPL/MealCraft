import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { runInInjectionContext, Injector } from '@angular/core';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from '../services/loading.service';

class MockLoadingService {
  start = vi.fn();
  stop = vi.fn();
}

function createRequest(method = 'GET', url = '/api/data', options: any = {}) {
  return new HttpRequest(method, url, options.body, {
    params: options.params,
    headers: options.headers || undefined
  });
}

describe('loadingInterceptor', () => {
  let loadingService: MockLoadingService;
  let injector: Injector;

  beforeEach(() => {
    loadingService = new MockLoadingService();
    TestBed.configureTestingModule({
      providers: [
        { provide: LoadingService, useValue: loadingService }
      ]
    });
    injector = TestBed.inject(Injector);
  });

  it('should call start and stop for normal requests', async () => {
    const req = createRequest();
    const response = new HttpResponse({ body: { ok: true } });
    const next = vi.fn(() => of(response));
    const result = await runInInjectionContext(injector, () => loadingInterceptor(req, next).toPromise());
    expect(result).toBe(response);
    expect(loadingService.start).toHaveBeenCalledTimes(1);
    expect(loadingService.stop).toHaveBeenCalledTimes(1);
  });

  it('should not call start/stop if x-skip-loader header is true', async () => {
    const req = createRequest('GET', '/api/data', { headers: { get: (h: string) => h === 'x-skip-loader' ? 'true' : null } });
    const response = new HttpResponse({ body: { ok: true } });
    const next = vi.fn(() => of(response));
    const result = await runInInjectionContext(injector, () => loadingInterceptor(req, next).toPromise());
    expect(result).toBe(response);
    expect(loadingService.start).not.toHaveBeenCalled();
    expect(loadingService.stop).not.toHaveBeenCalled();
  });

  it('should call stop even if next throws', async () => {
    const req = createRequest();
    const error = new Error('fail');
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => loadingInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(loadingService.start).toHaveBeenCalledTimes(1);
    expect(loadingService.stop).toHaveBeenCalledTimes(1);
  });
});
