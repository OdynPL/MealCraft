
import { UserSettingsComponent } from './user-settings';
import { AuthService } from '../../../core/services/auth.service';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';


describe('UserSettingsComponent Theme Functionality', () => {
  let component: UserSettingsComponent;
  let fixture: ComponentFixture<UserSettingsComponent>;
  let authServiceMock: Partial<AuthService>;
  let user: any;
  let userSignal: WritableSignal<any>;

  let localStorageMock: any;
  beforeEach(() => {
    user = { id: 1, theme: 'blue' };
    userSignal = signal(user);
    authServiceMock = {
      currentUser: userSignal,
      getAllUsersPublic: async () => [user],
    };
    // Assign non-standard methods directly to the mock object to avoid TS2353
    (authServiceMock as any).writeUsersCache = () => {};
    (authServiceMock as any).writeSessionCache = () => {};
    // Mock localStorage
    localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
      ],
      imports: [UserSettingsComponent],
    });
    fixture = TestBed.createComponent(UserSettingsComponent);
    component = fixture.componentInstance;
    document.body.className = '';
    localStorage.clear();
    // Expose a public wrapper for protected onThemeChange for testing
    (component as any).callOnThemeChange = (theme: string) => component['onThemeChange'](theme);
  });


  it('should initialize with user theme if present', () => {
    user.theme = 'green';
    (userSignal as WritableSignal<any>).set(user);
    const theme = component['getInitialTheme']();
    expect(theme).toBe('green');
    expect(document.body.classList.contains('theme-green')).toBeTruthy();
  });


  it('should initialize with stored theme if present in localStorage', () => {
    localStorage.setItem('food-explorer.user-theme-1', 'red');
    user.theme = 'blue';
    (userSignal as WritableSignal<any>).set(user);
    const theme = component['getInitialTheme']();
    expect(theme).toBe('red');
    expect(document.body.classList.contains('theme-red')).toBeTruthy();
  });


  it('should default to light theme if no user or stored theme', () => {
    (userSignal as WritableSignal<any>).set(null);
    const theme = component['getInitialTheme']();
    expect(theme).toBe('light');
    expect(document.body.classList.contains('theme-light')).toBeTruthy();
  });


  it('should apply theme to document body', () => {
    component['themeService'].applyTheme('purple');
    expect(document.body.classList.contains('theme-purple')).toBeTruthy();
    expect(document.body.classList.contains('theme-light')).toBeFalsy();
  });


  it('should persist theme in localStorage and update body class', async () => {
    user.theme = 'light';
    (userSignal as WritableSignal<any>).set(user);
    await (component as any).callOnThemeChange('gray');
    expect(localStorage.getItem('food-explorer.user-theme-1')).toBe('gray');
    expect(document.body.classList.contains('theme-gray')).toBeTruthy();
  });
});
