import { ChangeDetectionStrategy, Component, Input, computed, inject, effect, signal, OnInit, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
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

export class MealCommentsComponent implements OnChanges, OnInit {
  @Input({ required: true }) mealId!: number;
  private readonly auth = inject(AuthService);
  protected readonly commentsService = inject(MealCommentsService);
  protected readonly editingId = signal<number|null>(null);
  protected readonly editControl = new FormControl('', [Validators.required, Validators.maxLength(1000)]);
  protected readonly commentControl = new FormControl('', [Validators.required, Validators.maxLength(1000)]);

  protected readonly isLoggedIn = computed(() => {
    try {
      return !!(this.auth as any)?.isLoggedIn?.();
    } catch { return false; }
  });
  protected readonly currentUser = computed(() => {
    try {
      return (this.auth as any)?.currentUser?.();
    } catch { return undefined; }
  });

  constructor() {}
  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);

  formatComment(content: string): SafeHtml {
    // Zamień znaki nowej linii na <br> i oznacz jako bezpieczne HTML
    return this.sanitizer.bypassSecurityTrustHtml(
      content.replace(/\n/g, '<br>')
    );
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {}


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
