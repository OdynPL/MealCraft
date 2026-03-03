import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';

import { ActivityArea, ActivityLogEntry, ActivityStatus } from '../../../core/models/activity-log';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-activity-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule
  ],
  templateUrl: './activity-log.html',
  styleUrl: './activity-log.scss'
})
export class ActivityLogComponent {
  private readonly activityLog = inject(ActivityLogService);
  private readonly dialog = inject(MatDialog);

  protected readonly searchTerm = signal('');
  protected readonly areaFilter = signal<'all' | ActivityArea>('all');
  protected readonly statusFilter = signal<'all' | ActivityStatus>('all');
  protected readonly pageSize = signal(20);
  protected readonly pageIndex = signal(0);
  protected readonly pageSizeOptions = [10, 20, 50, 100] as const;

  protected readonly entries = this.activityLog.entries;
  protected readonly filteredEntries = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const area = this.areaFilter();
    const status = this.statusFilter();

    return this.entries().filter((entry) => {
      if (area !== 'all' && entry.area !== area) {
        return false;
      }

      if (status !== 'all' && entry.status !== status) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        entry.action,
        entry.details,
        entry.target,
        entry.actor?.email,
        entry.actor?.name,
        entry.actor?.role,
        entry.area,
        entry.status,
        entry.timestamp
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });
  });
  protected readonly totalItems = computed(() => this.filteredEntries().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  protected readonly pagedEntries = computed(() => {
    const currentPage = Math.min(this.pageIndex(), this.totalPages() - 1);
    const size = this.pageSize();
    const start = currentPage * size;
    return this.filteredEntries().slice(start, start + size);
  });
  protected readonly pageFrom = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    const currentPage = Math.min(this.pageIndex(), this.totalPages() - 1);
    return currentPage * this.pageSize() + 1;
  });
  protected readonly pageTo = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    return Math.min(this.pageFrom() + this.pageSize() - 1, this.totalItems());
  });

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.searchTerm.set(value);
    this.pageIndex.set(0);
  }

  protected setAreaFilter(value: string): void {
    this.areaFilter.set((value as 'all' | ActivityArea) ?? 'all');
    this.pageIndex.set(0);
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set((value as 'all' | ActivityStatus) ?? 'all');
    this.pageIndex.set(0);
  }

  protected setPageSize(value: string): void {
    const parsed = Number(value);
    this.pageSize.set(Number.isFinite(parsed) && parsed > 0 ? parsed : 20);
    this.pageIndex.set(0);
  }

  protected prevPage(): void {
    this.pageIndex.update((current) => Math.max(0, current - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((current) => Math.min(this.totalPages() - 1, current + 1));
  }

  protected async clearLog(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Clean activity log',
        message: 'Do you want to permanently remove all activity log entries?',
        confirmLabel: 'Clean log',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.activityLog.clear();
    this.pageIndex.set(0);
  }

  protected exportCsv(): void {
    const rows = this.filteredEntries();
    if (rows.length === 0) {
      return;
    }

    const header = ['Time', 'Area', 'Status', 'Actor', 'Action', 'Target', 'Details'];
    const lines = rows.map((entry) => ([
      entry.timestamp,
      entry.area,
      entry.status,
      this.actorLabel(entry),
      entry.action,
      entry.target ?? '',
      entry.details ?? ''
    ].map(csvEscape).join(',')));

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    anchor.href = url;
    anchor.download = `activity-log-${date}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  protected actorLabel(entry: ActivityLogEntry): string {
    const actorName = entry.actor?.name?.trim();
    const actorEmail = entry.actor?.email?.trim();

    if (actorName && actorEmail) {
      return `${actorName} (${actorEmail})`;
    }

    if (actorName) {
      return actorName;
    }

    if (actorEmail) {
      return actorEmail;
    }

    return 'System';
  }
}

function csvEscape(value: string): string {
  const normalized = value.replace(/\r?\n|\r/g, ' ');
  if (normalized.includes(',') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}
