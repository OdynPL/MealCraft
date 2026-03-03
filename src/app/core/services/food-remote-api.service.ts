import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, throwError } from 'rxjs';

import {
  MealDbAreaResponseDto,
  MealDbCategoryResponseDto,
  MealDbDetailDto,
  MealDbDetailResponseDto,
  MealDbMealDto,
  MealDbSearchResponseDto
} from '../dto';
import { Food, FoodDetail } from '../models';
import { ConfigurationService } from './configuration.service';

const API_AUTHOR = 'TheMealDB';

@Injectable({ providedIn: 'root' })
export class FoodRemoteApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigurationService);

  getFacets(): Observable<{ cuisines: string[]; categories: string[] }> {
    const cuisines$ = this.mealDbGet<MealDbAreaResponseDto>(
      this.config.listEndpoint,
      new HttpParams().set('a', 'list')
    ).pipe(
      map((res) => (res.meals ?? []).map((item) => item.strArea).filter(Boolean)),
      map((items) => items.sort((a, b) => a.localeCompare(b))),
      catchError(() => of([]))
    );

    const categories$ = this.mealDbGet<MealDbCategoryResponseDto>(
      this.config.listEndpoint,
      new HttpParams().set('c', 'list')
    ).pipe(
      map((res) => (res.meals ?? []).map((item) => item.strCategory).filter(Boolean)),
      map((items) => items.sort((a, b) => a.localeCompare(b))),
      catchError(() => of([]))
    );

    return forkJoin({ cuisines: cuisines$, categories: categories$ });
  }

  searchMeals(searchText: string): Observable<Food[]> {
    return this.mealDbGet<MealDbSearchResponseDto>(
      this.config.searchEndpoint,
      new HttpParams().set('s', searchText)
    ).pipe(
      catchError(() => of({ meals: [] } as MealDbSearchResponseDto)),
      map((res) => res.meals ?? []),
      map((meals) => meals.map((item) => this.toFood(item)))
    );
  }

  getMealDetails(id: number): Observable<FoodDetail | null> {
    return this.mealDbGet<MealDbDetailResponseDto>(
      this.config.lookupEndpoint,
      new HttpParams().set('i', String(id))
    ).pipe(
      map((res) => {
        const meal = res.meals?.[0];
        return meal ? this.toFoodDetail(meal) : null;
      })
    );
  }

  private toFood(item: MealDbMealDto): Food {
    const baseTags = buildTags(item.strArea ?? '', item.strCategory ?? '');

    return {
      id: Number(item.idMeal),
      title: item.strMeal,
      image: item.strMealThumb,
      imageType: getImageType(item.strMealThumb),
      sourceUrl: normalizeExternalUrl(item.strSource),
      cuisine: item.strArea ?? '',
      category: item.strCategory ?? '',
      tags: baseTags,
      author: API_AUTHOR,
      createdAt: new Date(0).toISOString()
    };
  }

  private toFoodDetail(item: MealDbDetailDto): FoodDetail {
    const tags = [
      ...(item.strTags ? item.strTags.split(',').map((value) => value.trim()).filter(Boolean) : []),
      ...buildTags(item.strArea ?? '', item.strCategory ?? '')
    ];

    return {
      id: Number(item.idMeal),
      title: item.strMeal,
      image: item.strMealThumb,
      category: item.strCategory ?? '',
      cuisine: item.strArea ?? '',
      instructions: item.strInstructions ?? '',
      sourceUrl: normalizeExternalUrl(item.strSource),
      youtubeUrl: normalizeExternalUrl(item.strYoutube),
      tags: [...new Set(tags)],
      author: API_AUTHOR,
      createdAt: new Date(0).toISOString()
    };
  }

  private mealDbGet<T>(endpoint: string, params?: HttpParams): Observable<T> {
    const baseUrl = `${this.config.mealDbBaseUrl}${endpoint}`;

    if (!this.config.useMealDbCorsProxy) {
      return this.http.get<T>(baseUrl, params ? { params } : undefined);
    }

    const urlWithQuery = buildUrlWithQuery(baseUrl, params);
    const proxiedUrls = this.config.mealDbCorsProxyCandidates
      .map((proxyBaseUrl) => `${proxyBaseUrl}${encodeURIComponent(urlWithQuery)}`);

    return this.requestWithProxyFallback<T>(proxiedUrls, 0);
  }

  private requestWithProxyFallback<T>(proxyUrls: readonly string[], index: number): Observable<T> {
    if (index >= proxyUrls.length) {
      return throwError(() => new Error('MealDB proxy unavailable.'));
    }

    return this.http.get<T>(proxyUrls[index]).pipe(
      catchError(() => this.requestWithProxyFallback<T>(proxyUrls, index + 1))
    );
  }
}

function buildUrlWithQuery(url: string, params?: HttpParams): string {
  if (!params) {
    return url;
  }

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function getImageType(imageUrl: string): string {
  const extension = imageUrl.split('.').pop();
  return extension ? extension.toLowerCase() : 'jpg';
}

function buildTags(cuisine: string, category: string): string[] {
  return [cuisine, category].filter((value) => value.trim().length > 0);
}

function normalizeExternalUrl(value: string | null | undefined): string | undefined {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    const protocol = url.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
