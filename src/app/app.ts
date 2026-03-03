import { Component, inject, signal } from '@angular/core';
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
}
