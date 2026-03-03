import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConfigurationService } from './configuration.service';
import { FoodRemoteApiService } from './food-remote-api.service';

describe('FoodRemoteApiService', () => {
  let service: FoodRemoteApiService;
  let httpMock: HttpTestingController;
  let config: ConfigurationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfigurationService,
        FoodRemoteApiService
      ]
    });

    service = TestBed.inject(FoodRemoteApiService);
    httpMock = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ConfigurationService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should map search response into Food list', () => {
    let resultTitles: string[] = [];

    service.searchMeals('arr').subscribe((items) => {
      resultTitles = items.map((item) => item.title);
    });

    const req = httpMock.expectOne((request) => decodeURIComponent(request.url).includes('/search.php'));
    req.flush({
      meals: [
        {
          idMeal: '52771',
          strMeal: 'Spicy Arrabiata Penne',
          strMealThumb: 'https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg',
          strArea: 'Italian',
          strCategory: 'Vegetarian',
          strSource: null
        }
      ]
    });

    expect(resultTitles).toEqual(['Spicy Arrabiata Penne']);
  });

  it('should return meal details when meal exists', () => {
    let detailTitle: string | null = null;

    service.getMealDetails(52771).subscribe((detail) => {
      detailTitle = detail?.title ?? null;
    });

    const req = httpMock.expectOne((request) => decodeURIComponent(request.url).includes('/lookup.php'));
    req.flush({
      meals: [
        {
          idMeal: '52771',
          strMeal: 'Spicy Arrabiata Penne',
          strMealThumb: 'https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg',
          strArea: 'Italian',
          strCategory: 'Vegetarian',
          strInstructions: 'Boil pasta and mix with sauce.',
          strTags: 'Pasta,Curry',
          strSource: null,
          strYoutube: null
        }
      ]
    });

    expect(detailTitle).toBe('Spicy Arrabiata Penne');
  });

  it('should fallback to cors proxy when direct request fails', () => {
    let resultCount = 0;

    Object.defineProperty(config, 'useMealDbCorsProxy', { value: false, configurable: true });

    service.searchMeals('arr').subscribe((items) => {
      resultCount = items.length;
    });

    const directReq = httpMock.expectOne((request) =>
      request.url.includes('www.themealdb.com/api/json/v1/1/search.php')
    );
    directReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    const proxyReq = httpMock.expectOne((request) =>
      request.url.startsWith('https://api.codetabs.com/v1/proxy?quest=')
    );
    proxyReq.flush({
      meals: [
        {
          idMeal: '52771',
          strMeal: 'Spicy Arrabiata Penne',
          strMealThumb: 'https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg',
          strArea: 'Italian',
          strCategory: 'Vegetarian',
          strSource: null
        }
      ]
    });

    expect(resultCount).toBe(1);
  });
});
