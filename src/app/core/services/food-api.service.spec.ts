import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';
import { FoodApiService } from './food-api.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

class MockAuthService {
  currentUser() {
    return {
      id: 500,
      email: 'owner@example.com',
      firstName: 'Owner',
      lastName: 'User',
      phone: '+48123456789',
      age: 30,
      createdAt: new Date('2025-01-01').toISOString()
    };
  }
}

class MockLocalRecipeService {
  getSnapshot() {
    return {
      custom: [
        {
          id: 30001,
          title: 'Owned Local',
          image: 'https://example.com/owned.jpg',
          category: 'Pasta',
          cuisine: 'Italian',
          instructions: 'Cook.',
          tags: ['fresh'],
          ownerId: 500,
          author: 'Owner User',
          createdAt: new Date('2025-02-01').toISOString()
        },
        {
          id: 30002,
          title: 'Legacy Local',
          image: 'https://example.com/legacy.jpg',
          category: 'Soup',
          cuisine: 'Polish',
          instructions: 'Boil.',
          tags: ['warm'],
          author: 'owner@example.com',
          createdAt: new Date('2025-02-02').toISOString()
        },
        {
          id: 30003,
          title: 'Foreign Local',
          image: 'https://example.com/foreign.jpg',
          category: 'Beef',
          cuisine: 'French',
          instructions: 'Bake.',
          tags: ['rich'],
          ownerId: 999,
          author: 'Other User',
          createdAt: new Date('2025-02-03').toISOString()
        }
      ],
      overrides: [],
      deletedIds: []
    };
  }

  getFacetValues() {
    return { cuisines: [], categories: [] };
  }
}

class MockRecipeFeedbackService {
  getScore(): number {
    return 0;
  }
}

describe('FoodApiService', () => {
  let service: FoodApiService;
  let httpMock: HttpTestingController;

  const dummyRecipes = [
    {
      title: 'Dummy Recipe 1',
      image: 'assets/recipes/recipe-0001.svg',
      cuisine: 'Italian',
      category: 'Pasta',
      tags: ['example'],
      instructions: 'Cook and serve.'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FoodApiService,
        ConfigurationService,
        { provide: AuthService, useClass: MockAuthService },
        { provide: LocalRecipeService, useClass: MockLocalRecipeService },
        { provide: RecipeFeedbackService, useClass: MockRecipeFeedbackService }
      ]
    });

    service = TestBed.inject(FoodApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return only owned recipes when mineOnly is true', () => {
    let resultTitles: string[] = [];

    service.search({
      query: '',
      cuisine: '',
      category: '',
      mineOnly: true,
      sortBy: 'id',
      sortDirection: 'desc',
      pageIndex: 0,
      pageSize: 20,
      refreshTick: 0
    }).subscribe((page) => {
      resultTitles = page.items.map((item) => item.title);
    });

    const req = httpMock.expectOne((request) => request.url.includes('/search.php'));
    req.flush({
      meals: [
        {
          idMeal: '100',
          strMeal: 'API meal',
          strMealThumb: 'https://example.com/api.jpg',
          strArea: 'Italian',
          strCategory: 'Pasta',
          strSource: null
        }
      ]
    });

    const dummyReq = httpMock.expectOne('data/example-recipes.json');
    dummyReq.flush(dummyRecipes);

    expect(resultTitles).toContain('Owned Local');
    expect(resultTitles).toContain('Legacy Local');
    expect(resultTitles).not.toContain('Foreign Local');
    expect(resultTitles).not.toContain('API meal');
  });

  it('should include all recipes when mineOnly is false', () => {
    let resultTitles: string[] = [];

    service.search({
      query: 'Local',
      cuisine: '',
      category: '',
      mineOnly: false,
      sortBy: 'name',
      sortDirection: 'asc',
      pageIndex: 0,
      pageSize: 50,
      refreshTick: 0
    }).subscribe((page) => {
      resultTitles = page.items.map((item) => item.title);
    });

    const req = httpMock.expectOne((request) => request.url.includes('/search.php'));
    req.flush({
      meals: [
        {
          idMeal: '100',
          strMeal: 'API meal',
          strMealThumb: 'https://example.com/api.jpg',
          strArea: 'Italian',
          strCategory: 'Pasta',
          strSource: null
        }
      ]
    });

    const dummyReq = httpMock.expectOne('data/example-recipes.json');
    dummyReq.flush(dummyRecipes);

    expect(resultTitles).toContain('Owned Local');
    expect(resultTitles).toContain('Legacy Local');
    expect(resultTitles).toContain('Foreign Local');
    expect(resultTitles).not.toContain('API meal');
  });

  it('should return dummy recipes when API request fails', () => {
    let resultTitles: string[] = [];

    service.search({
      query: 'Dummy Recipe',
      cuisine: '',
      category: '',
      mineOnly: false,
      sortBy: 'name',
      sortDirection: 'asc',
      pageIndex: 0,
      pageSize: 10,
      refreshTick: 0
    }).subscribe((page) => {
      resultTitles = page.items.map((item) => item.title);
    });

    const req = httpMock.expectOne((request) => request.url.includes('/search.php'));
    req.flush('network error', {
      status: 500,
      statusText: 'Server Error'
    });

    const dummyReq = httpMock.expectOne('data/example-recipes.json');
    dummyReq.flush(dummyRecipes);

    expect(resultTitles.length).toBeGreaterThan(0);
    expect(resultTitles.some((title) => title.startsWith('Dummy Recipe'))).toBe(true);
  });
});
