import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConfigurationService } from './configuration.service';
import { FoodRemoteApiService } from './food-remote-api.service';

describe('FoodRemoteApiService', () => {
  let service: FoodRemoteApiService;
  let httpMock: HttpTestingController;

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
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should map search response into Food list', () => {
    let resultTitles: string[] = [];

    service.searchMeals('arr').subscribe((items) => {
      resultTitles = items.map((item) => item.title);
    });

    const req = httpMock.expectOne((request) => request.url.includes('/search.php'));
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

    const req = httpMock.expectOne((request) => request.url.includes('/lookup.php'));
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
});
