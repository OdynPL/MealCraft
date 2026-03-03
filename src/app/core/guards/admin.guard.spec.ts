import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

class MockRouter {
  createUrlTree = vi.fn().mockReturnValue('redirect-home');
}

describe('adminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useClass: MockRouter }
      ]
    });
  });

  it('should allow navigation for admin user', () => {
    TestBed.overrideProvider(AuthService, {
      useValue: {
        currentUser: () => ({ role: 'admin' })
      }
    });

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('should redirect non-admin user to home', () => {
    TestBed.overrideProvider(AuthService, {
      useValue: {
        currentUser: () => ({ role: 'user' })
      }
    });

    const router = TestBed.inject(Router) as unknown as MockRouter;
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe('redirect-home');
  });

  it('should redirect guest to home', () => {
    TestBed.overrideProvider(AuthService, {
      useValue: {
        currentUser: () => null
      }
    });

    const router = TestBed.inject(Router) as unknown as MockRouter;
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe('redirect-home');
  });
});
