import { Routes } from '@angular/router';
import { BodyComponent } from './features/body/body';
import { AddRecipeComponent } from './features/add-recipe/add-recipe';
import { AuthComponent } from './features/auth/auth';
import { MealDetailsComponent } from './features/meal-details/meal-details';
import { SettingsComponent } from './features/settings/settings';
import { authGuard } from './core/guards/auth.guard';
import { guestOnlyGuard } from './core/guards/guest-only.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: BodyComponent,
  },
  {
    path: 'meals',
    component: BodyComponent,
  },
  {
    path: 'meals/new',
    component: AddRecipeComponent,
    canActivate: [authGuard]
  },
  {
    path: 'login',
    component: AuthComponent,
    canActivate: [guestOnlyGuard],
    data: { mode: 'login' }
  },
  {
    path: 'register',
    component: AuthComponent,
    canActivate: [guestOnlyGuard],
    data: { mode: 'register' }
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'meals/:id/edit',
    component: AddRecipeComponent,
    canActivate: [authGuard]
  },
  {
    path: 'meals/:id',
    component: MealDetailsComponent,
  },
  {
    path: '**',
    redirectTo: 'home',
  }
];