import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { of, switchMap } from 'rxjs';

import { FoodDetail } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';
import { FoodApiService } from '../../core/services/food-api.service';
import { LocalRecipeService } from '../../core/services/local-recipe.service';
import { FoodStore } from '../../core/stores/food.store';

@Component({
  selector: 'app-add-recipe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
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
  private readonly api = inject(FoodApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(FoodStore);
  private readonly config = inject(ConfigurationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly titleControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
  });
  protected readonly cuisineControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(40)]
  });
  protected readonly categoryControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(40)]
  });
  protected readonly instructionsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]
  });
  protected readonly sourceUrlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(300), Validators.pattern(/^$|https?:\/\/.+/i)]
  });
  protected readonly youtubeUrlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(300), Validators.pattern(/^$|https?:\/\/.+/i)]
  });
  protected readonly tagsControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(200)]
  });

  protected readonly imagePreview = signal(this.config.localRecipePlaceholderImage);
  protected readonly imageError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly recipeId = signal<number | null>(null);
  protected readonly loadedRecipe = signal<FoodDetail | null>(null);
  protected readonly isEditMode = computed(() => this.recipeId() !== null);
  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
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

  protected async submit(): Promise<void> {
    this.submitError.set(null);

    if (!this.auth.currentUser()) {
      this.submitError.set('Login is required to add or edit recipes.');
      await this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    if (this.formInvalid() || this.imageError()) {
      this.markAllTouched();
      return;
    }

    const tags = this.tagsControl.value
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const draft = {
      title: this.titleControl.value.trim(),
      cuisine: this.cuisineControl.value.trim(),
      category: this.categoryControl.value.trim(),
      instructions: this.instructionsControl.value.trim(),
      image: this.uploadedImage,
      sourceUrl: normalizeOptional(this.sourceUrlControl.value),
      youtubeUrl: normalizeOptional(this.youtubeUrlControl.value),
      tags
    };

    const editId = this.recipeId();
    const recipe = editId ? this.recipes.save(editId, draft, this.loadedRecipe() ?? undefined) : this.recipes.add(draft);

    this.store.reset();
    await this.router.navigate(['/meals', recipe.id]);
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
}

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
