import { TestBed } from '@angular/core/testing';

import { AuthUser } from '../models';
import { AuthService } from './auth.service';
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

describe('RecipeFeedbackService', () => {
  let service: RecipeFeedbackService;
  let auth: MockAuthService;
  const votesKey = 'foodExplorerVotes';
  const tagsKey = 'foodExplorerTags';

  const firstUser: AuthUser = {
    id: 1001,
    email: 'user-one@example.com',
    firstName: 'User',
    lastName: 'One',
    phone: '+48111111111',
    age: 25,
    createdAt: new Date('2025-01-01').toISOString()
  };

  const secondUser: AuthUser = {
    id: 1002,
    email: 'user-two@example.com',
    firstName: 'User',
    lastName: 'Two',
    phone: '+48222222222',
    age: 29,
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
        { provide: AuthService, useClass: MockAuthService }
      ]
    });

    service = TestBed.inject(RecipeFeedbackService);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
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
});
