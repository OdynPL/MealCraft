import { TestBed } from '@angular/core/testing';

import { AuthUser } from '../models';
import { LocalRecipeDraft } from '../models/local-recipe';
import { AuthService } from './auth.service';
import { LocalRecipeService } from './local-recipe.service';

class MockAuthService {
  private user: AuthUser | null = null;

  currentUser(): AuthUser | null {
    return this.user;
  }

  setCurrentUser(user: AuthUser | null): void {
    this.user = user;
  }
}

describe('LocalRecipeService', () => {
  let service: LocalRecipeService;
  let auth: MockAuthService;
  const storageKey = 'food-app.local-recipes';
  let storageData: Record<string, string>;

  const loggedUser: AuthUser = {
    id: 7001,
    email: 'chef@example.com',
    firstName: 'Chef',
    lastName: 'Master',
    phone: '+48123456789',
    age: 31,
    createdAt: new Date('2025-03-01').toISOString()
  };

  const baseDraft: LocalRecipeDraft = {
    title: 'Test Recipe',
    cuisine: 'Italian',
    category: 'Pasta',
    instructions: 'Mix ingredients and cook for 20 minutes.',
    tags: ['quick', 'quick', 'home']
  };

  beforeEach(() => {
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

    globalThis.localStorage.setItem(storageKey, JSON.stringify({ custom: [], overrides: [], deletedIds: [] }));

    TestBed.configureTestingModule({
      providers: [
        LocalRecipeService,
        { provide: AuthService, useClass: MockAuthService }
      ]
    });

    service = TestBed.inject(LocalRecipeService);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
  });

  it('should require login to add recipe', () => {
    expect(() => service.add(baseDraft)).toThrowError('Login is required to add recipes.');
  });

  it('should add recipe with deduplicated tags and author from current user', () => {
    auth.setCurrentUser(loggedUser);

    const created = service.add(baseDraft);

    expect(created.id).toBeGreaterThan(0);
    expect(created.author).toBe('Chef Master');
    expect(created.image).toContain('placehold.co');
    expect(created.tags).toEqual(['quick', 'home']);
    expect(service.getAllCustom()).toHaveLength(1);
  });

  it('should update existing custom recipe while preserving createdAt and author', () => {
    auth.setCurrentUser(loggedUser);
    const created = service.add(baseDraft);

    const updated = service.save(created.id, {
      ...baseDraft,
      title: 'Updated Recipe',
      cuisine: 'Mexican',
      tags: ['spicy', 'spicy']
    });

    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated Recipe');
    expect(updated.cuisine).toBe('Mexican');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.author).toBe(created.author);
    expect(updated.tags).toEqual(['spicy']);
  });

  it('should mark non-custom recipe as deleted', () => {
    const persisted = {
      custom: [],
      overrides: [
        {
          id: 55,
          title: 'Overridden',
          image: 'https://example.com/image.jpg',
          category: 'Soup',
          cuisine: 'Polish',
          instructions: 'Cook',
          tags: ['classic'],
          author: 'API',
          createdAt: new Date('2025-01-01').toISOString()
        }
      ],
      deletedIds: []
    };

    globalThis.localStorage.setItem(storageKey, JSON.stringify(persisted));

    service.delete(55);

    expect(service.getById(55)).toBeUndefined();
    expect(service.isDeleted(55)).toBe(true);
  });

  it('should compute unique sorted facet values from custom and overrides', () => {
    const persisted = {
      custom: [
        {
          id: 90,
          title: 'A',
          image: 'https://example.com/a.jpg',
          category: 'Pasta',
          cuisine: 'Italian',
          instructions: 'Cook',
          tags: [],
          author: 'A',
          createdAt: new Date('2025-02-01').toISOString()
        }
      ],
      overrides: [
        {
          id: 91,
          title: 'B',
          image: 'https://example.com/b.jpg',
          category: 'Soup',
          cuisine: 'Polish',
          instructions: 'Cook',
          tags: [],
          author: 'B',
          createdAt: new Date('2025-02-02').toISOString()
        },
        {
          id: 92,
          title: 'C',
          image: 'https://example.com/c.jpg',
          category: 'Pasta',
          cuisine: 'Italian',
          instructions: 'Cook',
          tags: [],
          author: 'C',
          createdAt: new Date('2025-02-03').toISOString()
        }
      ],
      deletedIds: []
    };

    globalThis.localStorage.setItem(storageKey, JSON.stringify(persisted));

    const facets = service.getFacetValues();

    expect(facets.categories).toEqual(['Pasta', 'Soup']);
    expect(facets.cuisines).toEqual(['Italian', 'Polish']);
  });
});
