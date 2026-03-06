import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { GlobalErrorLogService } from '../services/global-error-log.service';

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationService);
  const errorLog = inject(GlobalErrorLogService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        let userMessage = 'Unexpected server error.';
        if (error.status === 0) {
          userMessage = 'No connection to server.';
        } else if (error.status === 401) {
          userMessage = 'Session expired. Please log in again.';
        } else if (error.status === 403) {
          userMessage = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
          userMessage = 'Resource not found.';
        } else if (error.status >= 500) {
          userMessage = 'Server error. Please try again later.';
        }
        notifications.error(userMessage);
        errorLog.log({
          timestamp: new Date(),
          message: error.message,
          stack: error.error?.stack,
          context: `HTTP ${error.status} ${error.statusText}`,
          code: error.status ?? undefined
        });
      }
      return throwError(() => error);
    })
  );
};
