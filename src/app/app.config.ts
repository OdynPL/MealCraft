import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/services/global-error-handler';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './core/http/http-cache.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';
import { httpErrorInterceptor } from './core/http/http-error.interceptor';

function isLazyChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror')
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    provideRouter(
      routes,
      withHashLocation(),
      withNavigationErrorHandler((error) => {
        if (!isLazyChunkLoadError(error)) {
          return;
        }

        const reloadKey = 'mealcraft-lazy-chunk-reload';
        if (sessionStorage.getItem(reloadKey) === '1') {
          sessionStorage.removeItem(reloadKey);
          return;
        }

        sessionStorage.setItem(reloadKey, '1');
        location.reload();
      })
    ),
    provideHttpClient(withInterceptors([loadingInterceptor, httpCacheInterceptor, httpErrorInterceptor])),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { floatLabel: 'always' }
    },
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    }
  ]
};
