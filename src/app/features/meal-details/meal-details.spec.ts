import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MealDetailsComponent } from './meal-details';
import { AuthService } from '../../core/services/auth.service';
import { FoodService } from '../../core/services/food.service';
import { NotificationService } from '../../core/services/notification.service';
import { RecipeFeedbackService } from '../../core/services/recipe-feedback.service';
import { FoodStore } from '../../core/stores/food.store';

class MockAuthService {
  isLoggedIn = vi.fn().mockReturnValue(true);
  currentUser = vi.fn().mockReturnValue({ id: 7001 });
}

class MockFoodService {
  getMealDetails = vi.fn();
}

class MockRecipeFeedbackService {
  getTags = vi.fn().mockReturnValue(['Easy', 'Quick']);
  getScore = vi.fn().mockReturnValue(3);
  canVote = vi.fn().mockReturnValue(true);
  upvote = vi.fn();
  downvote = vi.fn();
}

class MockNotificationService {
  success = vi.fn();
  error = vi.fn();
  info = vi.fn();
}

class MockFoodStore {
  reset = vi.fn();
  canEditRecipe = vi.fn().mockReturnValue(true);
  canDeleteRecipe = vi.fn().mockReturnValue(true);
  deleteRecipe = vi.fn();
}

class MockRouter {
  url = '/meals/123';
  navigate = vi.fn().mockResolvedValue(true);
}

class MockMatDialog {
  open = vi.fn().mockReturnValue({
    afterClosed: () => of(true)
  });
}


describe('MealDetailsComponent', () => {
  let component: MealDetailsComponent;
  let fixture: ComponentFixture<MealDetailsComponent>;
  let feedback: MockRecipeFeedbackService;
  let notifications: MockNotificationService;
  let store: MockFoodStore;
  let router: MockRouter;
  let storageData: Record<string, string>;

  const meal = {
    id: 123,
    title: 'Tomato Pasta',
    image: 'https://example.com/meal.jpg',
    category: 'Dinner',
    cuisine: 'Italian',
    instructions: 'Step one. Step two.',
    sourceUrl: 'https://example.com/source',
    youtubeUrl: 'https://youtube.com/watch?v=abc',
    tags: ['Easy', 'Quick'],
    author: 'Chef',
    createdAt: new Date('2025-01-01').toISOString()
  };

  async function setup(options?: {
    canVote?: boolean;
    isLoggedIn?: boolean;
    userId?: number | null;
    confirmDelete?: boolean;
    routeId?: string;
    mealDetails?: typeof meal | null;
  }): Promise<void> {
    const canVote = options?.canVote ?? true;
    const isLoggedIn = options?.isLoggedIn ?? true;
    const userId = options?.userId ?? 7001;
    const confirmDelete = options?.confirmDelete ?? true;
    const routeId = options?.routeId ?? '123';
    const mealDetails = options?.mealDetails ?? meal;

    const authMock = new MockAuthService();
    authMock.isLoggedIn.mockReturnValue(isLoggedIn);
    authMock.currentUser.mockReturnValue(userId === null ? null : { id: userId });

    const foodServiceMock = new MockFoodService();
    foodServiceMock.getMealDetails.mockReturnValue(of(mealDetails));

    const feedbackMock = new MockRecipeFeedbackService();
    feedbackMock.canVote.mockReturnValue(canVote);

    const notificationsMock = new MockNotificationService();
    const storeMock = new MockFoodStore();
    const routerMock = new MockRouter();
    const dialogMock = new MockMatDialog();
    dialogMock.open.mockReturnValue({ afterClosed: () => of(confirmDelete) });

    await TestBed.configureTestingModule({
      imports: [MealDetailsComponent],
      providers: [
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: FoodService, useValue: foodServiceMock },
        { provide: RecipeFeedbackService, useValue: feedbackMock },
        { provide: NotificationService, useValue: notificationsMock },
        { provide: FoodStore, useValue: storeMock },
        { provide: Router, useValue: routerMock },
        { provide: MatDialog, useValue: dialogMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeId ? { id: routeId } : {}))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MealDetailsComponent);
    component = fixture.componentInstance;
    feedback = TestBed.inject(RecipeFeedbackService) as unknown as MockRecipeFeedbackService;
    notifications = TestBed.inject(NotificationService) as unknown as MockNotificationService;
    store = TestBed.inject(FoodStore) as unknown as MockFoodStore;
    router = TestBed.inject(Router) as unknown as MockRouter;
    await fixture.whenStable();
    fixture.detectChanges();
  }


  beforeEach(async () => {
    storageData = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => {
          storageData[key] = value;
        },
        removeItem: (key: string) => {
          delete storageData[key];
        }
      }
    });
    TestBed.resetTestingModule();
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('should render tags as read-only pills without remove button', async () => {
    await setup();

    const host = fixture.nativeElement as HTMLElement;
    const removeButton = host.querySelector('.tag-remove');
    const addTagText = host.textContent ?? '';

    expect(removeButton).toBeNull();
    expect(addTagText).not.toContain('Add tag');
  });

  it('should upvote when voting is allowed', async () => {
    await setup({ canVote: true });

    (component as any).upvote();

    expect(feedback.upvote).toHaveBeenCalledWith(123);
    expect(notifications.success).toHaveBeenCalledWith('Vote added.');
  });

  it('should not upvote when voting is blocked', async () => {
    await setup({ canVote: false });

    (component as any).upvote();

    expect(feedback.upvote).not.toHaveBeenCalled();
  });

  it('should redirect to login when deleting without authenticated user', async () => {
    await setup({ isLoggedIn: false, userId: null });

    (component as any).auth = {
      currentUser: () => null,
      isLoggedIn: () => false
    };
    (component as any).router = router;
    (component as any).notifications = notifications;

    await (component as any).deleteRecipe();

    expect(notifications.error).toHaveBeenCalledWith('Login is required to delete recipes.');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/meals/123' } });
    expect(store.deleteRecipe).not.toHaveBeenCalled();
  });

  it('should delete recipe and navigate home after confirmation', async () => {
    await setup({ confirmDelete: true });

    const openSpy = vi.fn().mockReturnValue({ afterClosed: () => of(true) });
    (component as any).dialog = { open: openSpy };
    (component as any).store = store;
    (component as any).router = router;

    await (component as any).deleteRecipe();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(store.deleteRecipe).toHaveBeenCalledWith(123);
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
