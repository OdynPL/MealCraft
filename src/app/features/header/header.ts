import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { FoodStore } from '../../core/stores/food.store';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly store = inject(FoodStore);
  private readonly router = inject(Router);
  protected readonly mobileMenuOpen = signal(false);

  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  protected readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  protected readonly userFullName = computed(() => this.auth.fullName());
  protected readonly userAvatar = computed(() => this.auth.currentUser()?.avatar ?? '');
  protected readonly userInitials = computed(() => buildInitials(this.auth.currentUser()?.firstName, this.auth.currentUser()?.lastName));

  protected resetState(): void {
    this.store.reset();
    this.mobileMenuOpen.set(false);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    this.mobileMenuOpen.set(false);
    await this.router.navigate(['/home']);
  }

}

function buildInitials(firstName?: string, lastName?: string): string {
  const left = firstName?.trim().charAt(0) ?? '';
  const right = lastName?.trim().charAt(0) ?? '';
  return `${left}${right}`.toUpperCase() || 'U';
}
