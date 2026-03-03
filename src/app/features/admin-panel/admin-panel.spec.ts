import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AdminPanelComponent } from './admin-panel';
import { AuthService } from '../../core/services/auth.service';

describe('AdminPanelComponent', () => {
  function createComponent(role: 'admin' | 'user' | null): { component: AdminPanelComponent; navigate: ReturnType<typeof vi.fn> } {
    const navigate = vi.fn().mockResolvedValue(true);
    const authMock = {
      currentUser: vi.fn().mockReturnValue(role ? { role } : null)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: { navigate } }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new AdminPanelComponent());
    return { component, navigate };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should redirect non-admin user to home', () => {
    const { navigate } = createComponent('user');
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should not redirect admin user', () => {
    const { navigate } = createComponent('admin');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should switch active menu', () => {
    const { component } = createComponent('admin');

    expect((component as any).activeMenu()).toBe('users');
    (component as any).setActiveMenu('activity');
    expect((component as any).activeMenu()).toBe('activity');
  });
});
