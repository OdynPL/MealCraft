import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './core/http/http-cache.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([loadingInterceptor, httpCacheInterceptor]))
  ]
};
