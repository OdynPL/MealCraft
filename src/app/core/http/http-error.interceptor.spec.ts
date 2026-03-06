import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { runInInjectionContext, Injector } from '@angular/core';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { httpErrorInterceptor } from './http-error.interceptor';
import { NotificationService } from '../services/notification.service';
import { GlobalErrorLogService } from '../services/global-error-log.service';

class MockNotificationService {
  error = vi.fn();
}
class MockGlobalErrorLogService {
  log = vi.fn();
}

function createRequest(method = 'GET', url = '/api/data', options: any = {}) {
  return new HttpRequest(method, url, options.body, {
    params: options.params,
    headers: options.headers || undefined
  });
}

describe('httpErrorInterceptor', () => {
  let notifications: MockNotificationService;
  let errorLog: MockGlobalErrorLogService;
  let injector: Injector;

  beforeEach(() => {
    notifications = new MockNotificationService();
    errorLog = new MockGlobalErrorLogService();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationService, useValue: notifications },
        { provide: GlobalErrorLogService, useValue: errorLog }
      ]
    });
    injector = TestBed.inject(Injector);
  });

  it('should pass through successful responses', async () => {
    const req = createRequest();
    const response = new HttpResponse({ body: { ok: true } });
    const next = vi.fn(() => of(response));
    const result = await runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise());
    expect(result).toBe(response);
    expect(notifications.error).not.toHaveBeenCalled();
    expect(errorLog.log).not.toHaveBeenCalled();
  });

  it('should handle 401 error', async () => {
    const req = createRequest();
    const error = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized', url: req.url, error: { stack: 'stacktrace' } });
    (error as any).message = '401 error';
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(notifications.error).toHaveBeenCalledWith('Session expired. Please log in again.');
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: '401 error', code: 401, context: expect.stringContaining('401') }));
  });

  it('should handle 404 error', async () => {
    const req = createRequest();
    const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: req.url, error: { stack: 'stacktrace' } });
    (error as any).message = '404 error';
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(notifications.error).toHaveBeenCalledWith('Resource not found.');
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: '404 error', code: 404, context: expect.stringContaining('404') }));
  });

  it('should handle 0 error (no connection)', async () => {
    const req = createRequest();
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown', url: req.url, error: { stack: 'stacktrace' } });
    (error as any).message = 'No connection';
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(notifications.error).toHaveBeenCalledWith('No connection to server.');
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: 'No connection', code: 0, context: expect.stringContaining('0') }));
  });

  it('should handle 500 error (server error)', async () => {
    const req = createRequest();
    const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error', url: req.url, error: { stack: 'stacktrace' } });
    (error as any).message = '500 error';
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(notifications.error).toHaveBeenCalledWith('Server error. Please try again later.');
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: '500 error', code: 500, context: expect.stringContaining('500') }));
  });

  it('should handle unknown error types by rethrowing', async () => {
    const req = createRequest();
    const error = new Error('Some other error');
    const next = vi.fn(() => throwError(() => error));
    await expect(runInInjectionContext(injector, () => httpErrorInterceptor(req, next).toPromise())).rejects.toBe(error);
    expect(notifications.error).not.toHaveBeenCalled();
    expect(errorLog.log).not.toHaveBeenCalled();
  });
});
