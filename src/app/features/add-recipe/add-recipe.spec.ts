import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AddRecipeComponent } from './add-recipe';
import { AuthService } from '../../core/services/auth.service';
import { FoodService } from '../../core/services/food.service';
import { LocalRecipeService } from '../../core/services/local-recipe.service';
import { FoodStore } from '../../core/stores/food.store';

class MockAuthService {
  isLoggedIn(): boolean {
    return true;
  }

  currentUser(): { id: number } | null {
    return { id: 7001 };
  }
}

class MockLocalRecipeService {
  save = vi.fn().mockReturnValue({ id: 100 });
  add = vi.fn().mockReturnValue({ id: 100 });
}

class MockFoodStore {
  canEditRecipe = vi.fn().mockReturnValue(true);
  reset = vi.fn();
}

class MockRouter {
  url = '/meals/123/edit';
  navigate = vi.fn().mockResolvedValue(true);
}

describe('AddRecipeComponent', () => {
  let component: AddRecipeComponent;
  let fixture: ComponentFixture<AddRecipeComponent>;
  let store: MockFoodStore;
  let router: MockRouter;
  let recipes: MockLocalRecipeService;

  const editRecipe = {
    id: 123,
    title: 'Edit me',
    image: 'https://example.com/image.jpg',
    category: 'Dinner',
    cuisine: 'Italian',
    instructions: 'Prepare ingredients and cook for 20 minutes.',
    sourceUrl: 'https://example.com',
    youtubeUrl: 'https://youtube.com/watch?v=abc',
    tags: ['easy'],
    author: 'Someone',
    createdAt: new Date('2025-01-01').toISOString()
  };

  async function setup(canEditRecipe: boolean): Promise<void> {
    const storeMock = new MockFoodStore();
    storeMock.canEditRecipe.mockReturnValue(canEditRecipe);

    const routerMock = new MockRouter();
    const recipeMock = new MockLocalRecipeService();

    await TestBed.configureTestingModule({
      imports: [AddRecipeComponent],
      providers: [
        provideHttpClientTesting(),
        { provide: AuthService, useClass: MockAuthService },
        { provide: LocalRecipeService, useValue: recipeMock },
        { provide: FoodStore, useValue: storeMock },
        { provide: Router, useValue: routerMock },
        {
          provide: FoodService,
          useValue: {
            getMealDetails: () => of(editRecipe)
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '123' }))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddRecipeComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(FoodStore) as unknown as MockFoodStore;
    router = TestBed.inject(Router) as unknown as MockRouter;
    recipes = TestBed.inject(LocalRecipeService) as unknown as MockLocalRecipeService;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', async () => {
    await setup(true);
    expect(component).toBeTruthy();
  });

  it('should disable update button when user cannot edit current recipe', async () => {
    await setup(false);

    const button = fixture.nativeElement.querySelector('mat-card-actions button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
  });

  it('should enable update button when user can edit current recipe', async () => {
    await setup(true);

    const button = fixture.nativeElement.querySelector('mat-card-actions button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it('should block submit for non-owned recipe and navigate home', async () => {
    await setup(false);

    await (component as any).submit();

    expect(recipes.save).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
