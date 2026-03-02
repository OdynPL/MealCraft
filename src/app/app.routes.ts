import { Routes } from '@angular/router';
import { BodyComponent } from './features/body/body';
import { AddRecipeComponent } from './features/add-recipe/add-recipe';
import { AuthComponent } from './features/auth/auth';
import { MealDetailsComponent } from './features/meal-details/meal-details';
import { SettingsComponent } from './features/settings/settings';

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
  },
  {
    path: 'login',
    component: AuthComponent,
    data: { mode: 'login' }
  },
  {
    path: 'register',
    component: AuthComponent,
    data: { mode: 'register' }
  },
  {
    path: 'settings',
    component: SettingsComponent,
  },
  {
    path: 'meals/:id/edit',
    component: AddRecipeComponent,
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