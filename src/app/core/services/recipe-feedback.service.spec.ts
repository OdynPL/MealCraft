import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthUser } from '../models';
import { AuthService } from './auth.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

class MockAuthService {
  private user: AuthUser | null = null;

  currentUser(): AuthUser | null {
    return this.user;
  }

  setCurrentUser(user: AuthUser | null): void {
    this.user = user;
  }
}

class MockLocalRecipeService {
  canCurrentUserManageOwnRecipe = vi.fn().mockReturnValue(false);
}

describe('RecipeFeedbackService', () => {
  let service: RecipeFeedbackService;
  let auth: MockAuthService;
  let localRecipes: MockLocalRecipeService;
  const votesKey = 'foodExplorerVotes';
  const tagsKey = 'foodExplorerTags';

  const firstUser: AuthUser = {
    id: 1001,
    email: 'user-one@example.com',
    firstName: 'User',
    lastName: 'One',
    phone: '+48111111111',
    age: 25,
    role: 'user',
    registrationDate: new Date('2025-01-01').toISOString(),
    isAccountLocked: false,
    emailVerified: false,
    createdAt: new Date('2025-01-01').toISOString()
  };

  const secondUser: AuthUser = {
    id: 1002,
    email: 'user-two@example.com',
    firstName: 'User',
    lastName: 'Two',
    phone: '+48222222222',
    age: 29,
    role: 'user',
    registrationDate: new Date('2025-01-02').toISOString(),
    isAccountLocked: false,
    emailVerified: false,
    createdAt: new Date('2025-01-02').toISOString()
  };

  beforeEach(() => {
    const storage = globalThis.localStorage as {
      setItem?: (key: string, value: string) => void;
    } | undefined;

    storage?.setItem?.(votesKey, '{}');
    storage?.setItem?.(tagsKey, '{}');

    TestBed.configureTestingModule({
      providers: [
        RecipeFeedbackService,
        { provide: AuthService, useClass: MockAuthService },
        { provide: LocalRecipeService, useClass: MockLocalRecipeService }
      ]
    });

    service = TestBed.inject(RecipeFeedbackService);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    localRecipes = TestBed.inject(LocalRecipeService) as unknown as MockLocalRecipeService;
  });

  it('should not allow guests to vote', () => {
    expect(service.canVote(10)).toBe(false);

    service.upvote(10);
    service.downvote(10);

    expect(service.getScore(10)).toBe(0);
  });

  it('should allow logged user to vote only once per recipe', () => {
    auth.setCurrentUser(firstUser);

    expect(service.canVote(12)).toBe(true);

    service.upvote(12);

    expect(service.getScore(12)).toBe(1);
    expect(service.canVote(12)).toBe(false);

    service.downvote(12);

    expect(service.getScore(12)).toBe(1);
  });

  it('should allow different users to vote on the same recipe', () => {
    auth.setCurrentUser(firstUser);
    service.upvote(25);

    auth.setCurrentUser(secondUser);
    expect(service.canVote(25)).toBe(true);

    service.downvote(25);

    expect(service.getScore(25)).toBe(0);
    expect(service.canVote(25)).toBe(false);
  });

  it('should not add tag for guest or non-owned recipe', () => {
    localRecipes.canCurrentUserManageOwnRecipe.mockReturnValue(false);

    service.addTag(77, 'spicy');

    expect(service.getTags({ id: 77, tags: [] })).toEqual([]);
  });

  it('should add and remove tags only when user owns recipe', () => {
    auth.setCurrentUser(firstUser);
    localRecipes.canCurrentUserManageOwnRecipe.mockImplementation((id: number) => id === 88);

    service.addTag(88, 'spicy');
    service.addTag(88, 'spicy');
    service.addTag(89, 'blocked');

    expect(service.getTags({ id: 88, tags: [] })).toEqual(['spicy']);
    expect(service.getTags({ id: 89, tags: [] })).toEqual([]);

    service.removeTag(89, 'blocked');
    expect(service.getTags({ id: 89, tags: [] })).toEqual([]);

    service.removeTag(88, 'spicy');
    expect(service.getTags({ id: 88, tags: [] })).toEqual([]);
  });
});
