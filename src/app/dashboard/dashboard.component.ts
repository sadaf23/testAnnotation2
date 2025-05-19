import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  onlineTime: string = '0h 0m';
  annotationsCount: number = 0;
  annotationOptions = [
    { name: 'Image Annotation' },
    // { name: 'label Annotation' },
  ];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.annotationsCount = Number(localStorage.getItem('annotations')) || 0;
    this.updateTime();
  
    // Update online time every minute
    setInterval(() => {
      this.updateTime();
    }, 60000);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  selectOption(option: any) {
    console.log(`Selected: ${option.name}`);
    const username = localStorage.getItem("username");

    if (option.name === 'label Annotation') {
      this.router.navigate(["/label-annotation"]); // Navigate to the label annotation route
    } else {
      this.router.navigate(["/annotation"]);
    }
}

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  updateTime() {
    const loginTime = Number(localStorage.getItem('loginTime'));
    if (loginTime) {
      const elapsedTime = Math.floor((Date.now() - loginTime) / 1000); // Convert to seconds
      this.onlineTime = this.formatTime(elapsedTime);
    }
}
isAdmin(): boolean {
  const username = localStorage.getItem("username");
  return username === 'admin';
}
navigateToAdminBoard() {
  console.log("Navigating to Admin Board");
  const username = localStorage.getItem("username");
  console.log("Current user:", username);
  this.router.navigate(["/admin-board"]);
}
discussionPoints(){
  this.router.navigate(["/discussion-points"]);
}
}
