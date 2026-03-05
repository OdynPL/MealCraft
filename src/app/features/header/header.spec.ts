import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { HeaderComponent } from './header';
import { AuthService } from '../../core/services/auth.service';
import { FoodStore } from '../../core/stores/food.store';

class MockAuthService {
  logout = vi.fn().mockResolvedValue(undefined);
  isLoggedIn = vi.fn().mockReturnValue(true);
  fullName = vi.fn().mockReturnValue('John Doe');
  currentUser = vi.fn().mockReturnValue({ firstName: 'John', lastName: 'Doe', avatar: '' });
}

class MockFoodStore {
  reset = vi.fn();
}

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let auth: MockAuthService;
  let store: MockFoodStore;
  let router: Router;

  beforeEach(async () => {
    // Mock localStorage for tests
    let storageData: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => { storageData[key] = value; },
        removeItem: (key: string) => { delete storageData[key]; },
        clear: () => { storageData = {}; }
      }
    });
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: AuthService, useClass: MockAuthService },
        { provide: FoodStore, useClass: MockFoodStore }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    store = TestBed.inject(FoodStore) as unknown as MockFoodStore;
    router = TestBed.inject(Router);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should logout, reset store and navigate to home', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await (component as any).logout();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(store.reset).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });
});
