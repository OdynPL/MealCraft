import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'roleLabel',
  standalone: true
})
export class RoleLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();

    if (normalized === 'admin') {
      return 'Admin';
    }

    if (normalized === 'user') {
      return 'User';
    }

    return 'User';
  }
}
