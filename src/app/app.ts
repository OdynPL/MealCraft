import { Component, inject, signal } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './features/header/header';
import { FooterComponent } from './features/footer/footer';
import { LoadingService } from './core/services/loading.service';


@Component({
  selector: 'app-root',
  
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly loadingService = inject(LoadingService);
  protected readonly title = signal('MealCraft');
  protected readonly isLoading = this.loadingService.isLoading;

  // Ensure theme is applied on every app load
  constructor() {
    const auth = inject(AuthService);
    const user = auth.currentUser();
    let theme = 'light';
    if (user) {
      try {
        const stored = (localStorage.getItem('food-explorer.user-theme-' + user.id) ?? '') as string;
        if ((['light', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'gray'] as string[]).includes(stored)) {
          theme = stored;
        } else if ((['light', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'gray'] as string[]).includes(user.theme ?? '')) {
          theme = user.theme ?? 'light';
        }
      } catch { /* ignore */ }
    }
    document.body.classList.remove('theme-light', 'theme-blue', 'theme-green', 'theme-red', 'theme-purple', 'theme-orange', 'theme-teal', 'theme-gray');
    document.body.classList.add(`theme-${theme}`);
  }
}
