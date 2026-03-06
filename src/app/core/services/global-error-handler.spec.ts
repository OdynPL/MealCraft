
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GlobalErrorHandler } from './global-error-handler';
import { GlobalErrorLogService } from './global-error-log.service';
import { NotificationService } from './notification.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let errorLog: { log: ReturnType<typeof vi.fn> };
  let notifications: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    errorLog = { log: vi.fn() };
    notifications = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: GlobalErrorLogService, useValue: errorLog },
        { provide: NotificationService, useValue: notifications }
      ]
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('should log and notify on string error', () => {
    handler.handleError('fail!');
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: 'fail!' }));
    expect(notifications.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'));
  });

  it('should log and notify on Error object', () => {
    const err = new Error('boom');
    handler.handleError(err);
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom', stack: err.stack }));
    expect(notifications.error).toHaveBeenCalled();
  });

  it('should log code if present', () => {
    const err = { message: 'fail', code: 404 };
    handler.handleError(err);
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ code: 404 }));
  });

  it('should stringify unknown object', () => {
    const err = { foo: 'bar' };
    handler.handleError(err);
    expect(errorLog.log).toHaveBeenCalledWith(expect.objectContaining({ message: JSON.stringify(err) }));
  });
});
