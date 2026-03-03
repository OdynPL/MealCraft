import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { AdminSettingsComponent } from './admin-settings/admin-settings';
import { UserSettingsComponent } from './user-settings/user-settings';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserSettingsComponent, AdminSettingsComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  constructor() {
    if (!this.auth.currentUser()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/settings' } });
    }
  }
}
