import { ConfigurationService } from './configuration.service';

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(() => {
    service = new ConfigurationService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose theme options', () => {
    expect(Array.isArray(service.themeOptions)).toBe(true);
    expect(service.themeOptions.some(opt => opt.value === 'light')).toBe(true);
  });

  it('should expose known cuisines and categories', () => {
    expect(service.knownCuisines).toContain('Polish');
    expect(service.knownCategories).toContain('Vegan');
  });

  it('should expose correct default roles and admin seed', () => {
    expect(service.authDefaultRole).toBe('user');
    expect(service.authAllowedRoles).toContain('admin');
    expect(service.authSeedAdminEmail).toBe('admin@admin.pl');
    expect(service.authSeedUsers.some(u => u.role === 'admin')).toBe(true);
  });

  it('should expose correct API endpoints', () => {
    expect(service.mealDbBaseUrl).toContain('themealdb.com');
    expect(service.searchEndpoint).toBe('/search.php');
  });

  it('should expose correct storage keys', () => {
    expect(typeof service.mailboxStorageKey).toBe('string');
    expect(typeof service.localRecipeStorageKey).toBe('string');
    expect(typeof service.activityLogStorageKey).toBe('string');
  });

  it('should expose correct UI config', () => {
    expect(Array.isArray(service.uiPageSizeOptions)).toBe(true);
    expect(service.defaultPageSize).toBeGreaterThan(0);
    expect(service.maxPageSize).toBeGreaterThan(service.minPageSize);
  });

  it('should expose correct feedback config', () => {
    expect(typeof service.feedbackVotesStorageKey).toBe('string');
    expect(service.feedbackTagMinLength).toBeLessThan(service.feedbackTagMaxLength);
  });

  it('should expose correct recipe config', () => {
    expect(service.recipeTitleMaxLength).toBeGreaterThan(10);
    expect(service.recipeInstructionsMaxLength).toBeGreaterThan(service.recipeInstructionsMinLength);
  });

  it('should expose correct auth config', () => {
    expect(service.authMinPasswordLength).toBeGreaterThan(0);
    expect(service.authMaxPasswordLength).toBeGreaterThan(service.authMinPasswordLength);
    expect(service.authMaxAvatarSizeBytes).toBeGreaterThan(0);
  });
});
