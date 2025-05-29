import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { CommonModule } from '@angular/common';
import { AutoLogoutService } from './auto-logout-service.service';
import { Observable, Subscription } from 'rxjs';
import { TimeTrackerService } from './time-tracker-service.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'annotation';
  totalTime: string = '00:00:00';
  isLoggedIn: boolean = false;
  username: string = '';
  password: string = '';
  private subscription!: Subscription;
  private authSubscription!: Subscription;
  currentUser$!: Observable<any>;

  constructor(private timeTrackerService: TimeTrackerService, public authService: AuthService, private router: Router, private autoLogoutService: AutoLogoutService) {}

  ngOnInit() {
    // Initialize totalTime from stored totalTimeMinutes
    this.currentUser$ = this.authService.currentUser$;
    const username = localStorage.getItem('username') || 'anonymous';
    const storedTime = localStorage.getItem(`totalTimeMinutes_${username}`);
    const totalMs = storedTime ? parseInt(storedTime, 10) * 60 * 1000 : 0;
    this.totalTime = this.formatDuration(totalMs);

    // Subscribe to login state changes
    this.authSubscription = this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      this.isLoggedIn = isLoggedIn;
      if (isLoggedIn) {
        // Start or resume timer subscription
        if (!this.subscription || this.subscription.closed) {
          this.subscription = this.timeTrackerService.getSessionDuration().subscribe(
            time => this.totalTime = time
          );
        }
      } else {
        // Stop timer subscription but keep totalTime
        if (this.subscription) {
          this.subscription.unsubscribe();
        }
        // Update totalTime to reflect stored totalTimeMinutes
        const username = localStorage.getItem('username') || 'anonymous';
        const storedTime = localStorage.getItem(`totalTimeMinutes_${username}`);
        const totalMs = storedTime ? parseInt(storedTime, 10) * 60 * 1000 : 0;
        this.totalTime = this.formatDuration(totalMs);
      }
    });

    // Start timer if already logged in (e.g., on page refresh)
    if (this.authService.isLoggedIn()) {
      this.timeTrackerService.startSessionTracking();
      this.subscription = this.timeTrackerService.getSessionDuration().subscribe(
        time => this.totalTime = time
      );
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.authService.isLoggedIn()) {
      this.timeTrackerService.stopSessionTracking();
    }
  }

  login() {
    if (this.username && this.password) {
      const success = this.authService.login(this.username, this.password);
      if (success) {
        console.log('Login successful');
        this.username = '';
        this.password = '';
      } else {
        console.log('Login failed');
      }
    }
  }

  private formatDuration(durationMs: number): string {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
