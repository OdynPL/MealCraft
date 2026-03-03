import { ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { of, switchMap } from 'rxjs';

import { FoodDetail } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';
import { FoodService } from '../../core/services/food.service';
import { LocalRecipeService } from '../../core/services/local-recipe.service';
import { NotificationService } from '../../core/services/notification.service';
import { FoodStore } from '../../core/stores/food.store';

@Component({
  selector: 'app-add-recipe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './add-recipe.html',
  styleUrl: './add-recipe.scss'
})
export class AddRecipeComponent {
  private readonly recipes = inject(LocalRecipeService);
  private readonly api = inject(FoodService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(FoodStore);
  private readonly config = inject(ConfigurationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cuisineOptionsState = signal<string[]>([...this.config.knownCuisines]);
  private readonly categoryOptionsState = signal<string[]>([...this.config.knownCategories]);

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.recipeTitleMaxLength)]
  });
  protected readonly cuisineControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(this.config.authMinNameLength),
      Validators.maxLength(this.config.recipeFacetMaxLength),
      (control) => this.validateFromOptions(control, this.cuisineOptionsState())
    ]
  });
  protected readonly categoryControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(this.config.authMinNameLength),
      Validators.maxLength(this.config.recipeFacetMaxLength),
      (control) => this.validateFromOptions(control, this.categoryOptionsState())
    ]
  });
  protected readonly instructionsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.recipeInstructionsMinLength), Validators.maxLength(this.config.recipeInstructionsMaxLength)]
  });
  protected readonly sourceUrlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(this.config.recipeUrlMaxLength), Validators.pattern(/^$|https?:\/\/.+/i)]
  });
  protected readonly youtubeUrlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(this.config.recipeUrlMaxLength), Validators.pattern(/^$|https?:\/\/.+/i)]
  });
  protected readonly tagsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(this.config.recipeTagsInputMaxLength)]
  });

  protected readonly imagePreview = signal(this.config.localRecipePlaceholderImage);
  protected readonly imageError = signal<string | null>(null);
  protected readonly validationError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly cuisineOptions = computed(() => this.cuisineOptionsState());
  protected readonly categoryOptions = computed(() => this.categoryOptionsState());
  protected readonly recipeId = signal<number | null>(null);
  protected readonly loadedRecipe = signal<FoodDetail | null>(null);
  protected readonly filteredCuisineOptions = computed(() => filterOptions(this.cuisineOptions(), this.cuisineControl.value));
  protected readonly filteredCategoryOptions = computed(() => filterOptions(this.categoryOptions(), this.categoryControl.value));
  protected readonly isEditMode = computed(() => this.recipeId() !== null);
  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly canEditRecipe = computed(() => {
    const editId = this.recipeId();
    if (editId === null) {
      return true;
    }

    return this.store.canEditRecipe(editId);
  });
  protected readonly formInvalid = computed(() => {
    return this.titleControl.invalid
      || this.cuisineControl.invalid
      || this.categoryControl.invalid
      || this.instructionsControl.invalid
      || this.sourceUrlControl.invalid
      || this.youtubeUrlControl.invalid
      || this.tagsControl.invalid;
  });

  private uploadedImage: string | undefined;

  constructor() {
    this.api.getFacets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ cuisines, categories }) => {
        this.cuisineOptionsState.set(mergeOptionSets(this.config.knownCuisines, cuisines));
        this.categoryOptionsState.set(mergeOptionSets(this.config.knownCategories, categories));
        this.cuisineControl.updateValueAndValidity({ emitEvent: false });
        this.categoryControl.updateValueAndValidity({ emitEvent: false });
      });

    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = Number(params.get('id'));
          if (!Number.isFinite(id) || id <= 0) {
            this.recipeId.set(null);
            return of(null);
          }

          this.recipeId.set(id);
          return this.api.getMealDetails(id);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((recipe) => {
        this.loadedRecipe.set(recipe);

        if (!recipe) {
          return;
        }

        this.titleControl.setValue(recipe.title);
        this.includeCurrentFacetValue(this.cuisineOptionsState, recipe.cuisine);
        this.includeCurrentFacetValue(this.categoryOptionsState, recipe.category);
        this.cuisineControl.setValue(recipe.cuisine);
        this.categoryControl.setValue(recipe.category);
        this.instructionsControl.setValue(recipe.instructions);
        this.sourceUrlControl.setValue(recipe.sourceUrl ?? '');
        this.youtubeUrlControl.setValue(recipe.youtubeUrl ?? '');
        this.tagsControl.setValue(recipe.tags.join(', '));
        this.uploadedImage = recipe.image;
        this.imagePreview.set(recipe.image || this.config.localRecipePlaceholderImage);
      });
  }

  protected onImageSelected(event: Event): void {
    this.imageError.set(null);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.uploadedImage = undefined;
      this.imagePreview.set(this.config.localRecipePlaceholderImage);
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.uploadedImage = undefined;
      this.imagePreview.set(this.config.localRecipePlaceholderImage);
      this.imageError.set('Only image files are allowed.');
      input.value = '';
      return;
    }

    if (file.size > this.config.maxUploadedImageSizeBytes) {
      this.uploadedImage = undefined;
      this.imagePreview.set(this.config.localRecipePlaceholderImage);
      this.imageError.set('Image is too large. Maximum size is 2 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '').trim();
      if (!result.startsWith('data:image/')) {
        this.uploadedImage = undefined;
        this.imagePreview.set(this.config.localRecipePlaceholderImage);
        this.imageError.set('Unable to read selected image.');
        return;
      }

      this.uploadedImage = result;
      this.imagePreview.set(result);
    };

    reader.onerror = () => {
      this.uploadedImage = undefined;
      this.imagePreview.set(this.config.localRecipePlaceholderImage);
      this.imageError.set('Unable to read selected image.');
    };

    reader.readAsDataURL(file);
  }

  protected onRecipeFormSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<void> {
    this.validationError.set(null);
    this.submitError.set(null);

    if (!this.auth.currentUser()) {
      this.submitError.set('Login is required to add or edit recipes.');
      this.notifications.error('Login is required to add or edit recipes.');
      await this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    if (this.formInvalid() || this.imageError()) {
      this.markAllTouched();
      this.validationError.set(this.firstValidationError());
      return;
    }

    if (this.isEditMode() && !this.canEditRecipe()) {
      this.submitError.set('You can edit only your own recipes.');
      this.notifications.error('You can edit only your own recipes.');
      await this.router.navigate(['/home']);
      return;
    }

    const tags = this.tagsControl.value
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const draft = {
      title: this.titleControl.value.trim(),
      cuisine: this.canonicalFacetValue(this.cuisineOptions(), this.cuisineControl.value),
      category: this.canonicalFacetValue(this.categoryOptions(), this.categoryControl.value),
      instructions: this.instructionsControl.value.trim(),
      image: this.uploadedImage,
      sourceUrl: normalizeOptional(this.sourceUrlControl.value),
      youtubeUrl: normalizeOptional(this.youtubeUrlControl.value),
      tags
    };

    try {
      const editId = this.recipeId();
      const recipe = editId ? this.recipes.save(editId, draft, this.loadedRecipe() ?? undefined) : this.recipes.add(draft);

      this.notifications.success(editId ? 'Recipe updated.' : 'Recipe created.');

      this.store.reset();
      await this.router.navigate(['/meals', recipe.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save recipe.';
      this.submitError.set(message);
      this.notifications.error(message);
    }
  }

  private markAllTouched(): void {
    this.titleControl.markAsTouched();
    this.cuisineControl.markAsTouched();
    this.categoryControl.markAsTouched();
    this.instructionsControl.markAsTouched();
    this.sourceUrlControl.markAsTouched();
    this.youtubeUrlControl.markAsTouched();
    this.tagsControl.markAsTouched();
  }

  private firstValidationError(): string {
    if (this.titleControl.hasError('required')) {
      return 'Recipe name is required.';
    }
    if (this.titleControl.hasError('minlength')) {
      return `Recipe name must be at least ${this.config.authMinNameLength} characters.`;
    }
    if (this.titleControl.hasError('maxlength')) {
      return `Recipe name must be at most ${this.config.recipeTitleMaxLength} characters.`;
    }

    if (this.cuisineControl.hasError('required') || this.cuisineControl.hasError('minlength') || this.cuisineControl.hasError('maxlength')) {
      return 'Enter a valid cuisine.';
    }
    if (this.cuisineControl.hasError('invalidOption')) {
      return 'Select cuisine from the list.';
    }

    if (this.categoryControl.hasError('required') || this.categoryControl.hasError('minlength') || this.categoryControl.hasError('maxlength')) {
      return 'Enter a valid category.';
    }
    if (this.categoryControl.hasError('invalidOption')) {
      return 'Select category from the list.';
    }

    if (this.instructionsControl.hasError('required')) {
      return 'Instructions are required.';
    }
    if (this.instructionsControl.hasError('minlength')) {
      return `Instructions must be at least ${this.config.recipeInstructionsMinLength} characters.`;
    }
    if (this.instructionsControl.hasError('maxlength')) {
      return `Instructions must be at most ${this.config.recipeInstructionsMaxLength} characters.`;
    }

    if (this.sourceUrlControl.hasError('pattern') || this.youtubeUrlControl.hasError('pattern')) {
      return 'Source/YouTube URL must start with http:// or https://.';
    }

    if (this.tagsControl.hasError('maxlength')) {
      return `Tags must be at most ${this.config.recipeTagsInputMaxLength} characters.`;
    }

    if (this.imageError()) {
      return this.imageError() ?? 'Image is invalid.';
    }

    return 'Please fix validation errors and try again.';
  }

  private validateFromOptions(control: AbstractControl<string>, options: readonly string[]): ValidationErrors | null {
    const value = control.value.trim();
    if (!value) {
      return null;
    }

    const normalizedValue = value.toLowerCase();
    const allowed = options.some((option) => option.toLowerCase() === normalizedValue);

    return allowed ? null : { invalidOption: true };
  }

  private canonicalFacetValue(options: string[], rawValue: string): string {
    const normalizedValue = rawValue.trim().toLowerCase();
    const matched = options.find((option) => option.toLowerCase() === normalizedValue);
    return matched ?? rawValue.trim();
  }

  private includeCurrentFacetValue(target: WritableSignal<string[]>, value: string): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    const next = mergeOptionSets(target(), [normalized]);
    target.set(next);
  }
}

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function filterOptions(options: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
}

function mergeOptionSets(base: readonly string[], extras: readonly string[]): string[] {
  const normalized = [...base, ...extras]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}
