import { ErrorHandler, Injectable, inject } from '@angular/core';
import { GlobalErrorLogService } from './global-error-log.service';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorLog = inject(GlobalErrorLogService);
  private readonly notifications = inject(NotificationService);

  handleError(error: unknown): void {
    let message = 'Unknown error';
    let code: string | number | undefined = undefined;
    let stack: string | undefined = undefined;
    const context = 'GlobalErrorHandler';

      if (error && typeof error === 'object') {
        const errObj = error as Record<string, unknown>;
        message = typeof errObj['message'] === 'string' ? errObj['message'] : JSON.stringify(error);
        const codeVal = errObj['code'];
        code = (typeof codeVal === 'string' || typeof codeVal === 'number') ? codeVal : undefined;
        stack = typeof errObj['stack'] === 'string' ? errObj['stack'] : undefined;
      } else {
        message = String(error);
    }

    this.errorLog.log({
      timestamp: new Date(),
      message,
      stack,
      context,
      code
    });
    this.notifications.error('Unexpected error occurred. Please try again or contact support.');
    // Optionally, rethrow or log to external service
    // throw error;
  }
}
