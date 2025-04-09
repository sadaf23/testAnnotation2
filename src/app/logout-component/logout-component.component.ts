import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TimeTrackerService } from '../time-tracker-service.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class LogoutComponent {
  constructor(private authService: AuthService,private router: Router, private timeTracker: TimeTrackerService) {}

  logout() {

      console.log('Logout button clicked'); // Debugging log
      this.timeTracker.stopSessionTracking(); // Ensure this is executed
      this.authService.logout();

    localStorage.removeItem('username');

    this.authService.logout(); // Clear authentication state
    this.router.navigate(['/login']); // Redirect to login page
  }
}
