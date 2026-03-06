import { ThemeService, ThemeName } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let originalBodyClass: string;
  let storageData: Record<string, string>;

  beforeEach(() => {
    service = new ThemeService();
    originalBodyClass = document.body.className;
    storageData = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => { storageData[key] = value; },
        removeItem: (key: string) => { delete storageData[key]; },
        clear: () => { storageData = {}; }
      }
    });
  });

  afterEach(() => {
    document.body.className = originalBodyClass;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should apply theme class to body', () => {
    service.applyTheme('blue');
    expect(document.body.classList.contains('theme-blue')).toBe(true);
    service.applyTheme('green');
    expect(document.body.classList.contains('theme-green')).toBe(true);
    expect(document.body.classList.contains('theme-blue')).toBe(false);
  });

  it('should return all palettes and getPalette', () => {
    const all = service.getAllPalettes();
    expect(Array.isArray(all)).toBe(true);
    expect(all.some(p => p.name === 'light')).toBe(true);
    expect(service.getPalette('red').name).toBe('red');
    expect(service.getPalette('unknown' as ThemeName).name).toBe('light');
  });

  it('should resolve user theme from localStorage', () => {
    storageData['food-explorer.user-theme-123'] = 'teal';
    const theme = service.resolveUserTheme({ id: 123, theme: 'blue' });
    expect(theme).toBe('teal');
  });

  it('should resolve user theme from user.theme if not in storage', () => {
    const theme = service.resolveUserTheme({ id: 1, theme: 'purple' });
    expect(theme).toBe('purple');
  });

  it('should fallback to light if theme is invalid', () => {
    const theme = service.resolveUserTheme({ id: 1, theme: 'not-a-theme' });
    expect(theme).toBe('light');
    expect(service.resolveUserTheme(null)).toBe('light');
  });
});
