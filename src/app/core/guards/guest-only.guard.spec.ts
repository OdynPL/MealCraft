import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { guestOnlyGuard } from './guest-only.guard';

class MockAuthService {
  constructor(private readonly loggedIn: boolean) {}

  currentUser(): { id: number } | null {
    return this.loggedIn ? { id: 1 } : null;
  }
}

describe('guestOnlyGuard', () => {
  it('should allow navigation for anonymous user', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: new MockAuthService(false) }
      ]
    });

    const result = TestBed.runInInjectionContext(() => guestOnlyGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('should redirect logged user to home', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: new MockAuthService(true) }
      ]
    });

    const result = TestBed.runInInjectionContext(() => guestOnlyGuard({} as never, {} as never));

    const router = TestBed.inject(Router);
    const expected = router.createUrlTree(['/home']);

    expect(String(result)).toBe(String(expected));
  });
});
