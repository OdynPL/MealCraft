import { Routes } from '@angular/router';
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
    loadComponent: () => import('./features/body/body').then((module) => module.BodyComponent),
  },
  {
    path: 'meals',
    loadComponent: () => import('./features/body/body').then((module) => module.BodyComponent),
  },
  {
    path: 'meals/new',
    loadComponent: () => import('./features/add-recipe/add-recipe').then((module) => module.AddRecipeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth').then((module) => module.AuthComponent),
    canActivate: [guestOnlyGuard],
    data: { mode: 'login' }
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/auth').then((module) => module.AuthComponent),
    canActivate: [guestOnlyGuard],
    data: { mode: 'register' }
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((module) => module.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'meals/:id/edit',
    loadComponent: () => import('./features/add-recipe/add-recipe').then((module) => module.AddRecipeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'meals/:id',
    loadComponent: () => import('./features/meal-details/meal-details').then((module) => module.MealDetailsComponent),
  },
  {
    path: '**',
    redirectTo: 'home',
  }
];