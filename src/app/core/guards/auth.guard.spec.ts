import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

class MockAuthService {
  constructor(private readonly loggedIn: boolean) {}

  currentUser(): { id: number } | null {
    return this.loggedIn ? { id: 1 } : null;
  }
}

describe('authGuard', () => {
  it('should allow navigation for logged user', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: new MockAuthService(true) }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/meals/new' } as never));

    expect(result).toBe(true);
  });

  it('should redirect anonymous user to login with returnUrl', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: new MockAuthService(false) }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/meals/new' } as never));

    const router = TestBed.inject(Router);
    const expected = router.createUrlTree(['/login'], {
      queryParams: { returnUrl: '/meals/new' }
    });

    expect(String(result)).toBe(String(expected));
  });
});
