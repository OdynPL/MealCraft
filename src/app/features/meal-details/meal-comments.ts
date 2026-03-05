// ...existing code...
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { MealCommentsService, MealComment } from '../../core/services/meal-comments.service';

@Component({
  selector: 'app-meal-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './meal-comments.html',
  styleUrl: './meal-comments.scss'
})

export class MealCommentsComponent {
      /**
       * Returns the initials (up to 2 letters) for a comment author
       */
      protected getAuthorInitials(author: string): string {
        if (!author) return '';
        return author
          .split(' ')
          .map(n => n[0])
          .filter(Boolean)
          .join('')
          .slice(0, 2)
          .toUpperCase();
      }
    /**
     * Returns comments for the current mealId
     */
    protected readonly mealComments = computed(() =>
      this.commentsService.comments().filter(c => c.mealId === this.mealId)
    );

    /**
     * Returns true if there are any comments for the current mealId
     */
    protected readonly hasMealComments = computed(() =>
      this.mealComments().length > 0
    );
  @Input({ required: true }) mealId!: number;
  private readonly auth = inject(AuthService);
  protected readonly commentsService = inject(MealCommentsService);
  protected readonly editingId = signal<number|null>(null);
  protected readonly editControl = new FormControl('', [Validators.required, Validators.maxLength(1000)]);
  protected readonly commentControl = new FormControl('', [Validators.required, Validators.maxLength(1000)]);

  protected readonly isLoggedIn = computed(() => {
    try {
      const isLoggedIn = this.auth.isLoggedIn;
      if (typeof isLoggedIn === 'function') {
        return !!isLoggedIn();
      } else if (typeof isLoggedIn === 'object' && isLoggedIn !== null && 'value' in isLoggedIn) {
        // @ts-expect-error: AuthService may expose isLoggedIn as a signal with a .value property
        return !!isLoggedIn.value;
      } else {
        return !!isLoggedIn;
      }
    } catch { return false; }
  });
  protected readonly currentUser = computed(() => {
    try {
      const currentUser = this.auth.currentUser;
      if (typeof currentUser === 'function') {
        return currentUser();
      } else if (typeof currentUser === 'object' && currentUser !== null && 'value' in currentUser) {
        // @ts-expect-error: AuthService may expose currentUser as a signal with a .value property
        return currentUser.value;
      } else {
        return currentUser;
      }
    } catch { return undefined; }
  });

  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);

  formatComment(content: string): SafeHtml {
    // Zamień znaki nowej linii na <br> i oznacz jako bezpieczne HTML
    return this.sanitizer.bypassSecurityTrustHtml(
      content.replace(/\n/g, '<br>')
    );
  }

  protected canEditOrDelete(comment: MealComment): boolean {
    const user = this.currentUser();
    return !!(user && `${user.firstName} ${user.lastName}`.trim() === comment.author);
  }

  protected startEdit(comment: MealComment) {
    this.editingId.set(comment.id!);
    this.editControl.setValue(comment.content);
  }

  protected cancelEdit() {
    this.editingId.set(null);
    this.editControl.reset();
  }

  protected saveEdit(comment: MealComment) {
    if (this.editControl.invalid) return;
    const updated: MealComment = { ...comment, content: this.editControl.value as string };
    this.commentsService.updateComment(updated);
    this.editingId.set(null);
    this.editControl.reset();
  }

  protected deleteComment(comment: MealComment) {
    if (!comment.id) return;
    this.commentsService.deleteComment(comment.id);
  }

  protected addComment() {
    if (this.commentControl.invalid || !this.currentUser() || !this.mealId) {
      return;
    }
    const value = this.commentControl.value;
    if (!value) {
      return;
    }
    const user = this.currentUser();
    const newComment = {
      mealId: Number(this.mealId),
      author: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      content: value.toString().trim(),
      createdAt: new Date().toISOString(),
      avatar: user?.avatar ?? undefined
    };
    this.commentsService.addComment(newComment);
    this.commentControl.reset();
  }
}
