import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loadingService = inject(LoadingService);

  if (request.headers.get('x-skip-loader') === 'true') {
    return next(request);
  }

  loadingService.start();

  return next(request).pipe(finalize(() => loadingService.stop()));
};
