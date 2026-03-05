import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { catchError, firstValueFrom, map, of, switchMap, tap } from 'rxjs';

import { FoodDetail } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { FoodService } from '../../core/services/food.service';
import { NotificationService } from '../../core/services/notification.service';
import { RecipeFeedbackService } from '../../core/services/recipe-feedback.service';
import { FoodStore } from '../../core/stores/food.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { MealCommentsComponent } from './meal-comments';

@Component({
  selector: 'app-meal-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MealCommentsComponent
  ],
  templateUrl: './meal-details.html',
  styleUrl: './meal-details.scss'
})
export class MealDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly api = inject(FoodService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(FoodStore);
  private readonly feedback = inject(RecipeFeedbackService);

  protected readonly item = signal<FoodDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly tags = computed(() => {
    const meal = this.item();
    if (!meal) {
      return [];
    }

    return this.feedback.getTags({ id: meal.id, tags: meal.tags });
  });
  protected readonly score = computed(() => {
    const mealId = this.item()?.id;
    return mealId ? this.feedback.getScore(mealId) : 0;
  });
  protected readonly instructionSteps = computed(() => {
    const instructions = this.item()?.instructions ?? '';
    return toInstructionSteps(instructions);
  });
  protected readonly hasMultipleInstructionSteps = computed(() => this.instructionSteps().length > 1);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.item.set(null);
        }),
        switchMap((id) => {
          if (!Number.isFinite(id) || id <= 0) {
            return of(null);
          }

          return this.api.getMealDetails(id).pipe(
            catchError(() => {
              this.error.set('Failed to load meal details.');
              return of(null);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => {
        this.item.set(value);
        if (!value && !this.error()) {
          this.error.set('Meal not found.');
        }
        this.loading.set(false);
      });
  }

  protected resetAndBack(): void {
    this.store.reset();
  }

  protected upvote(): void {
    const mealId = this.item()?.id;
    if (!mealId) {
      return;
    }

    if (!this.feedback.canVote(mealId)) {
      return;
    }

    this.feedback.upvote(mealId);
    this.notifications.success('Vote added.');
  }

  protected downvote(): void {
    const mealId = this.item()?.id;
    if (!mealId) {
      return;
    }

    if (!this.feedback.canVote(mealId)) {
      return;
    }

    this.feedback.downvote(mealId);
    this.notifications.success('Vote added.');
  }

  protected canVote(): boolean {
    const mealId = this.item()?.id;
    if (!mealId) {
      return false;
    }

    return this.feedback.canVote(mealId);
  }

  protected canDelete(): boolean {
    const mealId = this.item()?.id;
    if (!mealId) {
      return false;
    }

    return this.store.canDeleteRecipe(mealId);
  }

  protected canEdit(): boolean {
    const mealId = this.item()?.id;
    if (!mealId) {
      return false;
    }

    return this.store.canEditRecipe(mealId);
  }

  protected async deleteRecipe(): Promise<void> {
    const mealId = this.item()?.id;
    if (!mealId) {
      return;
    }

    if (!this.auth.currentUser()) {
      this.notifications.error('Login is required to delete recipes.');
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete recipe',
        message: 'Are you sure you want to delete this recipe?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.store.deleteRecipe(mealId);
    this.notifications.success('Recipe deleted.');
    await this.router.navigate(['/home']);
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  }
}

function toInstructionSteps(instructions: string): string[] {
  const normalized = instructions.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const lineBasedSteps = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^\d+[.)-]?\s*/, '').trim());

  if (lineBasedSteps.length > 1) {
    return lineBasedSteps;
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
