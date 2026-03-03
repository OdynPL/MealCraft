import { Pipe, PipeTransform } from '@angular/core';

import { ActivityStatus } from '../../../core/models/activity-log';

@Pipe({
  name: 'activityStatusColor',
  standalone: true
})
export class ActivityStatusColorPipe implements PipeTransform {
  transform(value: ActivityStatus | string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();

    if (normalized === 'success') {
      return 'log-status-success';
    }

    if (normalized === 'info') {
      return 'log-status-info';
    }

    if (normalized === 'warning') {
      return 'log-status-warning';
    }

    if (normalized === 'error') {
      return 'log-status-error';
    }

    return '';
  }
}
