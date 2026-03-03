import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';

import { AdminDataResetService } from '../../../core/services/admin-data-reset.service';
import { AppPreferencesService } from '../../../core/services/app-preferences.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FoodStore } from '../../../core/stores/food.store';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-admin-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatButtonModule
  ],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss'
})
export class AdminSettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly adminDataReset = inject(AdminDataResetService);
  private readonly preferences = inject(AppPreferencesService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(FoodStore);
  private readonly dialog = inject(MatDialog);

  protected readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  protected readonly includeDummyProducts = computed(() => this.preferences.includeDummyProducts());
  protected readonly adminResetInProgress = signal(false);

  protected onIncludeDummyProductsChange(enabled: boolean): void {
    if (!this.isAdmin()) {
      return;
    }

    this.preferences.setIncludeDummyProducts(enabled);
    this.store.reset();

    this.notifications.info(enabled
      ? 'Dummy products enabled.'
      : 'Dummy products disabled.');
  }

  protected async onAdminResetAllData(): Promise<void> {
    if (!this.isAdmin() || this.adminResetInProgress()) {
      return;
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reset application data',
        message: 'This will permanently remove all local recipes, user accounts, sessions, votes, tags and cached data. Continue?',
        confirmLabel: 'Reset and reload',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.adminResetInProgress.set(true);

    try {
      await this.adminDataReset.resetAllData();
      this.notifications.success('Application data has been reset. Reloading...');

      if (typeof globalThis.location !== 'undefined') {
        globalThis.location.reload();
      }
    } catch {
      this.notifications.error('Unable to reset application data.');
      this.adminResetInProgress.set(false);
    }
  }
}
