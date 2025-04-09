import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { CommonModule } from '@angular/common';
import { AutoLogoutService } from './auto-logout-service.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'annotation';
  constructor(public authService: AuthService, private router: Router, private autoLogoutService: AutoLogoutService) {}

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
