import { ChangeDetectionStrategy, Component, computed, inject, signal, DoCheck } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DatePipe } from '@angular/common';
import { GlobalErrorLogService } from '../../core/services/global-error-log.service';

@Component({
  selector: 'app-system-errors',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, DatePipe],
  templateUrl: './system-errors.html',
  styleUrl: './system-errors.scss'
})
export class SystemErrorsComponent implements DoCheck {
  private readonly errorLog = inject(GlobalErrorLogService);
  protected readonly searchTerm = signal('');
  protected readonly errors = computed(() => this.errorLog.errors);
  protected readonly filteredErrors = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.errors();
    return this.errors().filter(err => {
      const code = (err.code !== undefined && err.code !== null) ? String(err.code).toLowerCase() : '';
      return (
        err.message.toLowerCase().includes(term) ||
        (err.context?.toLowerCase().includes(term) ?? false) ||
        (err.stack?.toLowerCase().includes(term) ?? false) ||
        code.includes(term)
      );
    });
  });

  protected readonly expandedStack = signal<boolean[]>([]);

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  toggleStack(index: number) {
    const arr = [...this.expandedStack()];
    arr[index] = !arr[index];
    this.expandedStack.set(arr);
  }

  clear() {
    this.errorLog.clear();
    this.expandedStack.set([]);
  }

  // Synchronizuj expandedStack z liczbą błędów
  ngDoCheck() {
    const len = this.filteredErrors().length;
    if (this.expandedStack().length !== len) {
      this.expandedStack.set(Array(len).fill(false));
    }
  }
}
