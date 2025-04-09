import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthService } from './auth.service';
import { TimeTrackerService } from './time-tracker-service.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(), 
    AuthService,  // ✅ Ensure services are provided
    TimeTrackerService
  ]
};
