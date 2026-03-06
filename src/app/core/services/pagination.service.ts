import { Injectable, inject } from '@angular/core';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class PaginationService {
  private config = inject(ConfigurationService);

  recommendedPageSizeForWidth(width: number): number {
    if (width <= this.config.uiSmallViewportMaxWidth) {
      return this.config.uiSmallViewportPageSize;
    }
    if (width <= this.config.uiMediumViewportMaxWidth) {
      return this.config.uiMediumViewportPageSize;
    }
    return this.config.uiLargeViewportPageSize;
  }

  clampPageSize(pageSize: number): number {
    return Math.max(this.config.minPageSize, Math.min(pageSize, this.config.maxPageSize));
  }

  getPageSizeOptions(): number[] {
    return [...this.config.uiPageSizeOptions];
  }

  getDefaultPageSize(): number {
    return this.config.defaultPageSize;
  }

  getMaxPageSize(): number {
    return this.config.maxPageSize;
  }

  getMinPageSize(): number {
    return this.config.minPageSize;
  }
}
