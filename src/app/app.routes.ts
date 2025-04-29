import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { LoginComponent } from  './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AnnotationComponent } from './annotation/annotation.component';

  export const routes: Routes = [
    {
      path: 'login',
      loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
    },
    {
      path: 'annotation',
      loadComponent: () => import('./annotation/annotation.component').then(m => m.AnnotationComponent)
    },
    {
      path: 'label-annotation',
      loadComponent: () => import('./label-annotation/label-annotation.component').then(m => m.LabelAnnotationComponent)
    },
    {
      path: "admin-board", loadComponent:() => import('./admin-board/admin-board.component').then(m => m.AdminBoardComponent)
      },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: '**', redirectTo: 'login' }                    // ✅ Catch-all fallback
];


export const appRouting = provideRouter(routes);
