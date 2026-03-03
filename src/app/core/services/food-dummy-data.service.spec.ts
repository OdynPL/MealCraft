import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { FoodDummyDataService } from './food-dummy-data.service';

describe('FoodDummyDataService', () => {
  let service: FoodDummyDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FoodDummyDataService
      ]
    });

    service = TestBed.inject(FoodDummyDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should map example JSON into dummy foods', () => {
    let itemTitles: string[] = [];

    service.getFoods().subscribe((items) => {
      itemTitles = items.map((item) => item.title);
    });

    const req = httpMock.expectOne('data/example-recipes.json');
    req.flush([
      {
        title: 'Dummy pasta',
        image: 'assets/recipes/recipe-0001.svg',
        cuisine: 'Italian',
        category: 'Pasta',
        tags: ['quick'],
        instructions: 'Cook quickly.'
      }
    ]);

    expect(itemTitles).toEqual(['Dummy pasta']);
  });

  it('should map example JSON into dummy detail map', () => {
    let hasExpectedDetail = false;

    service.getDetails().subscribe((details) => {
      hasExpectedDetail = [...details.values()].some((detail) => detail.title === 'Dummy soup');
    });

    const req = httpMock.expectOne('data/example-recipes.json');
    req.flush([
      {
        title: 'Dummy soup',
        image: 'assets/recipes/recipe-0002.svg',
        cuisine: 'Polish',
        category: 'Soup',
        tags: ['warm'],
        instructions: 'Boil and serve.'
      }
    ]);

    expect(hasExpectedDetail).toBe(true);
  });
});
