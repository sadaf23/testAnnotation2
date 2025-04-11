import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TimeTrackerService } from './time-tracker-service.service';

@Injectable({
  providedIn: 'root',
})
export class AutoLogoutService {
  private timeoutId: any;
  private readonly TIMEOUT: number = 5 * 60 * 1000; // 5 minutes

  constructor(private router: Router, private ngZone: NgZone, private timeTracker: TimeTrackerService) {
    this.initListener();
    this.startTimer();
  }

  private initListener(): void {
    ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event =>
      window.addEventListener(event, () => this.resetTimer())
    );
  }

  private resetTimer(): void {
    clearTimeout(this.timeoutId);
    this.startTimer();
  }

  private startTimer(): void {
    // Optional: Only start timer if user is logged in (customize as needed)
    const isLoggedIn = !!localStorage.getItem('annotatorId');
    
    if (!isLoggedIn) return;

    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        alert('Session expired due to inactivity');

        this.timeTracker.stopSessionTracking(true);
        
        localStorage.clear();
        this.router.navigate(['/login']);
      });
    }, this.TIMEOUT);
  }
}
