import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { LoginComponent } from  './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AnnotationComponent } from './annotation/annotation.component';
// import { PrincipleAnnotatorComponent } from './principle-annotator/principle-annotator.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'annotation', component: AnnotationComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' },  // ✅ Redirect root path
  { path: '**', redirectTo: 'login' }                    // ✅ Catch-all fallback
];


export const appRouting = provideRouter(routes);
