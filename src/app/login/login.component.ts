import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  login() {
    if (!this.username.trim()) {
      alert('Please enter a username');
      return;
    }

    const isAuthenticated = this.authService.login(this.username, this.password);

    if (isAuthenticated) {
      // Store username after successful login
      localStorage.setItem('username', this.username);

      // Redirect to the annotation page
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage = 'Invalid credentials!';
    }
  }
}
