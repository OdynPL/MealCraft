
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpCacheInterceptor } from './http-cache.interceptor';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { HttpCacheService } from './http-cache.service';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { runInInjectionContext, Injector } from '@angular/core';

function createRequest(method = 'GET', url = '/api/data', options: any = {}) {
  return new HttpRequest(method, url, options.body, {
    params: options.params,
    headers: options.headers || undefined
  });
}

describe('httpCacheInterceptor', () => {
  let cache: { get: ReturnType<typeof vi.fn>, set: ReturnType<typeof vi.fn> };

  let injector: Injector;
  beforeEach(() => {
    cache = { get: vi.fn(), set: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpCacheService, useValue: cache }
      ]
    });
    injector = TestBed.inject(Injector);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should pass through non-cacheable requests', async () => {
    const req = createRequest('POST');
    const notCached = new HttpResponse({ body: 'not-cached' });
    const next = vi.fn(() => of(notCached));
    const result = await runInInjectionContext(injector, () => httpCacheInterceptor(req, next).toPromise());
    expect(result).toBe(notCached);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('should skip cache if x-skip-cache header is true', async () => {
    const req = createRequest('GET', '/api/data', { headers: { get: (h: string) => h === 'x-skip-cache' ? 'true' : null } });
    const noCache = new HttpResponse({ body: 'no-cache' });
    const next = vi.fn(() => of(noCache));
    const result = await runInInjectionContext(injector, () => httpCacheInterceptor(req, next).toPromise());
    expect(result).toBe(noCache);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('should return cached response if present', async () => {
    const req = createRequest('GET');
    const cached = new HttpResponse({ body: { foo: 'bar' } });
    cache.get.mockReturnValue(cached);
    const next = vi.fn();
    const result = await runInInjectionContext(injector, () => httpCacheInterceptor(req, next).toPromise());
    expect(result).toBe(cached);
    expect(next).not.toHaveBeenCalled();
  });

  it('should cache and return response if not cached', async () => {
    const req = createRequest('GET');
    cache.get.mockReturnValue(undefined);
    const response = new HttpResponse({ body: { foo: 'bar' } });
    const next = vi.fn(() => of(response));
    const result = await runInInjectionContext(injector, () => httpCacheInterceptor(req, next).toPromise());
    expect(result).toBe(response);
    expect(cache.set).toHaveBeenCalledWith('/api/data', response);
  });
});
