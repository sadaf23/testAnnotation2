import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TimeTrackerService } from './time-tracker-service.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$: Observable<boolean> = this.isLoggedInSubject.asObservable();

  // Add these lines for current user tracking
  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$: Observable<any> = this.currentUserSubject.asObservable();

  private users = [
    { username: 'drannotatorS', password: 'pass123', annotatorId: 'Dr.Siddharth' },
    { username: 'drannotatorR', password: 'pass234', annotatorId: 'Dr.Ruchir' },
    { username: 'annotator3', password: 'pass345', annotatorId: 'general' },
    { username: 'annotator4', password: 'pass456', annotatorId: 'general' },
    { username: 'annotator5', password: 'pass567', annotatorId: 'general' },
    { username: 'annotator6', password: 'pass678', annotatorId: 'general' },
    { username: 'annotator7', password: 'pass789', annotatorId: 'general' },
    { username: 'annotator8', password: 'pass890', annotatorId: 'general' },
    { username: 'annotator9', password: 'pass900', annotatorId: 'general' },
    { username: 'annotator10', password: 'pass011', annotatorId: 'general' },
    { username: 'admin', password: 'admin123', annotatorId: 'general' }
  ];

  constructor(private timeTracker: TimeTrackerService) {
    // Initialize login state from localStorage
    this.isLoggedInSubject.next(this.isLoggedIn());
    
    // Initialize current user from localStorage
    const storedUsername = localStorage.getItem('username');
    const storedAnnotatorId = localStorage.getItem('annotatorId');
    if (storedUsername && this.isLoggedIn()) {
      this.currentUserSubject.next({
        username: storedUsername,
        annotatorId: storedAnnotatorId
      });
    }
  }

  login(username: string, password: string): boolean {
    const user = this.users.find(u => u.username === username && u.password === password);
    
    if (user) {
      this.isLoggedInSubject.next(true);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      localStorage.setItem('annotatorId', user.annotatorId);
      
      // Update current user subject
      this.currentUserSubject.next({
        username: user.username,
        annotatorId: user.annotatorId
      });
      
      console.log('Stored in localStorage:', {
        isLoggedIn: localStorage.getItem('isLoggedIn'),
        username: localStorage.getItem('username'),
        annotatorId: localStorage.getItem('annotatorId')
      });

      this.timeTracker.startSessionTracking();
      return true;
    }
    return false;
  }

  logout(): void {
    if (!this.isLoggedInSubject.value) return;

    this.timeTracker.stopSessionTracking();
    
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('annotatorId');
    
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null); // Clear current user
  }

  isAdmin(): boolean {
    const username = localStorage.getItem('username');
    return username === 'admin';
  }

  isLoggedIn(): boolean {
    return localStorage.getItem('isLoggedIn') === 'true';
  }
}