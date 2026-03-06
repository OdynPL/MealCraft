import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';
import { ActivityLogComponent } from './activity-log/activity-log';
import { UserManagementComponent } from './user-management/user-management';
import { EmailNotificationsComponent } from './email-notifications/email-notifications';
import { SystemErrorsComponent } from './system-errors';

type AdminMenuKey = 'users' | 'activity' | 'email' | 'errors';

@Component({
  selector: 'app-admin-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UserManagementComponent,
    ActivityLogComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    EmailNotificationsComponent,
    SystemErrorsComponent
  ],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.scss'
})
export class AdminPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly activeMenu = signal<AdminMenuKey>('users');

  constructor() {
    if (this.auth.currentUser()?.role !== 'admin') {
      void this.router.navigate(['/home']);
    }
  }

  protected setActiveMenu(menu: AdminMenuKey): void {
    this.activeMenu.set(menu);
  }
}
