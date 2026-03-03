import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { FoodStore } from '../../core/stores/food.store';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly store = inject(FoodStore);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly userFullName = computed(() => this.auth.fullName());
  protected readonly userAvatar = computed(() => this.auth.currentUser()?.avatar ?? '');
  protected readonly userInitials = computed(() => buildInitials(this.auth.currentUser()?.firstName, this.auth.currentUser()?.lastName));

  protected resetState(): void {
    this.store.reset();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    this.notifications.info('Logged out.');
    await this.router.navigate(['/home']);
  }

}

function buildInitials(firstName?: string, lastName?: string): string {
  const left = firstName?.trim().charAt(0) ?? '';
  const right = lastName?.trim().charAt(0) ?? '';
  return `${left}${right}`.toUpperCase() || 'U';
}
