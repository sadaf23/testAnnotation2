import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { LoginComponent } from  './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AnnotationComponent } from './annotation/annotation.component';
// import { PrincipleAnnotatorComponent } from './principle-annotator/principle-annotator.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'annotation', component: AnnotationComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
  // { path: "principle-annotator", component: PrincipleAnnotatorComponent }
];

export const appRouting = provideRouter(routes);
