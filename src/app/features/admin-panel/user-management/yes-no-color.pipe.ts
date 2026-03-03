import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'yesNoColor',
  standalone: true
})
export class YesNoColorPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();

    if (normalized === 'yes') {
      return 'yes-no-yes';
    }

    if (normalized === 'no') {
      return 'yes-no-no';
    }

    return '';
  }
}
