import { Injectable, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ConfigurationService } from '../../core/services/configuration.service';
import { FoodSortBy, SortDirection } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class BodyStateService {
  private config = inject(ConfigurationService);

  syncControl(control: FormControl<string | null>, value: string): void {
    if (control.value !== value) {
      control.setValue(value, { emitEvent: false });
    }
  }

  parseSortBy(value: string | null): FoodSortBy {
    if (value === 'name' || value === 'tags' || value === 'votes') {
      return value;
    }
    return 'id';
  }

  parseSortDirection(value: string | null): SortDirection {
    return value === 'asc' ? 'asc' : 'desc';
  }

  parseNumber(value: string | null, fallback: number): number {
    if (value === null) {
      return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parseBoolean(value: string | null): boolean {
    return value === '1' || value === 'true';
  }

  // ...pozostałe metody bez paginacji...
}
