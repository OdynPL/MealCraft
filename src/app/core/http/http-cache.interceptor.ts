import { HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { HttpCacheService } from './http-cache.service';

export const httpCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const cache = inject(HttpCacheService);

  if (!isCacheable(request)) {
    return next(request);
  }

  const key = cacheKey(request);
  const cached = cache.get(key);
  if (cached) {
    return of(cached);
  }

  return cacheResponse(cache, key, next(request));
};

function isCacheable(request: HttpRequest<unknown>): boolean {
  return request.method === 'GET' && request.headers.get('x-skip-cache') !== 'true';
}

function cacheKey(request: HttpRequest<unknown>): string {
  const query = request.params.toString();
  return query ? `${request.url}?${query}` : request.url;
}

function cacheResponse(
  cache: HttpCacheService,
  key: string,
  stream: Observable<HttpEvent<unknown>>
): Observable<HttpEvent<unknown>> {
  return stream.pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cache.set(key, event);
      }
    })
  );
}
