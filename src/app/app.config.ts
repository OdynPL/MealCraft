import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withHashLocation } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { routes } from './app.routes';
import { httpCacheInterceptor } from './core/http/http-cache.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([loadingInterceptor, httpCacheInterceptor]))
  ]
};
