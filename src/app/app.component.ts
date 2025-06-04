import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { CommonModule } from '@angular/common';
import { AutoLogoutService } from './auto-logout-service.service';
import { filter, Observable, Subscription } from 'rxjs';
import { TimeTrackerService } from './time-tracker-service.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'annotation';
  totalTime: string = '00:00:00';
  showTimer: boolean = true;
  isLoggedIn: boolean = false;
  username: string = '';
  password: string = '';
  private subscription!: Subscription;
  private authSubscription!: Subscription;
  private resetSubscription!: Subscription;
  currentUser$!: Observable<any>;

  constructor(
    private timeTrackerService: TimeTrackerService, 
    public authService: AuthService, 
    private router: Router, 
    private autoLogoutService: AutoLogoutService
  ) {}

  ngOnInit() {
    // Handle route changes to hide timer on login page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.showTimer = event.urlAfterRedirects !== '/login';
    });

    this.currentUser$ = this.authService.currentUser$;

    // Subscribe to login state changes
    this.authSubscription = this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      this.isLoggedIn = isLoggedIn;
      if (isLoggedIn) {
        this.timeTrackerService.startSessionTracking();
        this.subscription = this.timeTrackerService.getSessionDuration().subscribe(
          time => this.totalTime = time
        );
      } else {
        if (this.subscription && !this.subscription.closed) {
          this.subscription.unsubscribe();
        }
        const username = localStorage.getItem('username') || 'anonymous';
        const storedTime = localStorage.getItem(`totalTimeMinutes_${username}`);
        const totalMs = storedTime ? parseInt(storedTime, 10) * 60 * 1000 : 0;
        this.totalTime = this.formatDuration(totalMs);
      }
    });

    // Subscribe to weekly reset events
    this.resetSubscription = this.timeTrackerService.getWeekResetObservable().subscribe(isReset => {
      if (isReset) {
        this.totalTime = '00:00:00'; // Reset displayed time
        console.log('UI updated due to weekly reset');
      }
    });

    // Start tracking if already logged in (handles page refresh)
    if (this.authService.isLoggedIn()) {
      this.timeTrackerService.startSessionTracking();
      this.subscription = this.timeTrackerService.getSessionDuration().subscribe(
        time => this.totalTime = time
      );
    }
  }

  ngOnDestroy() {
    if (this.subscription && !this.subscription.closed) {
      this.subscription.unsubscribe();
    }
    if (this.authSubscription && !this.authSubscription.closed) {
      this.authSubscription.unsubscribe();
    }
    if (this.resetSubscription && !this.resetSubscription.closed) {
      this.resetSubscription.unsubscribe();
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