import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { distinctUntilChanged, firstValueFrom, fromEvent, map, startWith } from 'rxjs';

import { Food, FoodSortBy, SortDirection } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { RecipeFeedbackService } from '../../core/services/recipe-feedback.service';
import { FoodStore } from '../../core/stores/food.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './body.html',
  styleUrl: './body.scss',
})
export class BodyComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly auth = inject(AuthService);
  protected readonly store = inject(FoodStore);
  protected readonly feedback = inject(RecipeFeedbackService);

  private isApplyingUrlState = false;
  private lastSyncedUrlState = '';

  protected readonly cuisineControl = new FormControl('', { nonNullable: true });
  protected readonly categoryControl = new FormControl('', { nonNullable: true });
  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(2), Validators.maxLength(60)]
  });
  protected readonly sortControl = new FormControl('id:desc', { nonNullable: true });

  protected readonly pageSizeOptions = [10, 12, 15, 20, 25];
  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly cuisines = computed(() => this.store.cuisines());
  protected readonly categories = computed(() => this.store.categories());
  protected readonly categoryCounts = computed(() => this.store.categoryCounts());

  protected readonly currentRangeLabel = computed(() => {
    const total = this.store.totalResults();
    const pageIndex = this.store.pageIndex();
    const pageSize = this.store.pageSize();

    if (total === 0) {
      return '0 of 0';
    }

    const from = pageIndex * pageSize + 1;
    const to = Math.min((pageIndex + 1) * pageSize, total);

    return `${from}-${to} of ${total}`;
  });

  constructor() {
    this.applyQueryParams(this.route.snapshot.queryParamMap);

    fromEvent(globalThis, 'resize')
      .pipe(
        startWith(null),
        map(() => recommendedPageSizeForWidth(globalThis.innerWidth)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((recommendedPageSize) => {
        if (this.store.pageSize() !== recommendedPageSize) {
          this.store.setPage(0, recommendedPageSize);
        }
      });

    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.searchControl.valid) {
          this.store.setQuery(value);
        }
      });

    this.cuisineControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.store.setCuisine(value));

    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.store.setCategory(value));

    this.sortControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const [sortBy, sortDirection] = value.split(':') as [FoodSortBy, SortDirection];
        this.store.setSort(sortBy, sortDirection);
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyQueryParams(params));

    effect(() => {
      syncControl(this.searchControl, this.store.query());
      syncControl(this.cuisineControl, this.store.cuisine());
      syncControl(this.categoryControl, this.store.category());
      syncControl(this.sortControl, `${this.store.sortBy()}:${this.store.sortDirection()}`);

      if (this.isApplyingUrlState) {
        return;
      }

      const queryParams = this.buildQueryParams();
      const nextState = JSON.stringify(queryParams);
      if (nextState === this.lastSyncedUrlState) {
        return;
      }

      this.lastSyncedUrlState = nextState;

      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        replaceUrl: true
      });
    });
  }

  protected onPageChange(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected trackByFoodId(_: number, food: { id: number }): number {
    return food.id;
  }

  protected upvote(mealId: number): void {
    this.feedback.upvote(mealId);
  }

  protected downvote(mealId: number): void {
    this.feedback.downvote(mealId);
  }

  protected score(mealId: number): number {
    return this.feedback.getScore(mealId);
  }

  protected canVote(mealId: number): boolean {
    return this.feedback.canVote(mealId);
  }

  protected tags(food: Food): string[] {
    return this.feedback.getTags(food);
  }

  protected selectCategoryFromPill(category: string): void {
    this.categoryControl.setValue(category);
  }

  protected clearCategoryFromPills(): void {
    this.categoryControl.setValue('');
  }

  protected refresh(): void {
    this.store.reset();
    this.lastSyncedUrlState = JSON.stringify({});
    void this.router.navigate(['/home'], { queryParams: {} });
  }

  protected deleteAllAndReload(): void {
    this.feedback.clearAll();
    this.store.deleteAllAndReload();
    this.lastSyncedUrlState = JSON.stringify({});
    void this.router.navigate(['/home'], { queryParams: {} });
  }

  protected async deleteRecipe(mealId: number): Promise<void> {
    if (!this.auth.currentUser()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
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

  private applyQueryParams(queryParamMap: { get: (name: string) => string | null }): void {
    const query = queryParamMap.get('q') ?? '';
    const cuisine = queryParamMap.get('cuisine') ?? '';
    const category = queryParamMap.get('category') ?? '';
    const sortBy = parseSortBy(queryParamMap.get('sortBy'));
    const sortDirection = parseSortDirection(queryParamMap.get('sortDir'));
    const page = parseNumber(queryParamMap.get('page'), 0);
    const pageSize = parseNumber(queryParamMap.get('pageSize'), this.store.pageSize());

    this.isApplyingUrlState = true;

    if (query !== this.store.query()) {
      this.store.setQuery(query);
    }

    if (cuisine !== this.store.cuisine()) {
      this.store.setCuisine(cuisine);
    }

    if (category !== this.store.category()) {
      this.store.setCategory(category);
    }

    if (sortBy !== this.store.sortBy() || sortDirection !== this.store.sortDirection()) {
      this.store.setSort(sortBy, sortDirection);
    }

    if (page !== this.store.pageIndex() || pageSize !== this.store.pageSize()) {
      this.store.setPage(Math.max(page, 0), Math.max(pageSize, 1));
    }

    this.lastSyncedUrlState = JSON.stringify(this.buildQueryParams());
    this.isApplyingUrlState = false;
  }

  private buildQueryParams(): Record<string, string | number> {
    const queryParams: Record<string, string | number> = {};

    if (this.store.query()) {
      queryParams['q'] = this.store.query();
    }
    if (this.store.cuisine()) {
      queryParams['cuisine'] = this.store.cuisine();
    }
    if (this.store.category()) {
      queryParams['category'] = this.store.category();
    }
    if (this.store.sortBy() !== 'id') {
      queryParams['sortBy'] = this.store.sortBy();
    }
    if (this.store.sortDirection() !== 'desc') {
      queryParams['sortDir'] = this.store.sortDirection();
    }
    if (this.store.pageIndex() > 0) {
      queryParams['page'] = this.store.pageIndex();
    }
    if (this.store.pageSize() !== 10) {
      queryParams['pageSize'] = this.store.pageSize();
    }

    return queryParams;
  }

}

function syncControl(control: FormControl<string>, value: string): void {
  if (control.value !== value) {
    control.setValue(value, { emitEvent: false });
  }
}

function parseSortBy(value: string | null): FoodSortBy {
  if (value === 'name' || value === 'tags') {
    return value;
  }

  return 'id';
}

function parseSortDirection(value: string | null): SortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recommendedPageSizeForWidth(width: number): number {
  if (width <= 740) {
    return 10;
  }

  if (width <= 1500) {
    return 12;
  }

  return 10;
}
