import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimeTrackerService {
  private backendUrl = 'http://localhost:8080';
  private prodUrl = 'https://backend-268040451245.us-central1.run.app';
  private startTime: Date | null = null;
  private totalTimeMinutes = 0;
  private saveCount = 0;
  private username = '';

  constructor(private http: HttpClient) {
    this.username = localStorage.getItem('username') || 'anonymous';
    const storedTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
    this.totalTimeMinutes = storedTime ? parseInt(storedTime, 10) : 0;
  }

  startSessionTracking(): void {
    if (this.startTime) {
      console.warn('Session tracking already active');
      return;
    }
    this.startTime = new Date();
    this.username = localStorage.getItem('username') || 'anonymous';
    this.saveCount = 0;
    const storedTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
    this.totalTimeMinutes = storedTime ? parseInt(storedTime, 10) : 0;
    console.log(`Tracking started for user: ${this.username}, Total time: ${this.totalTimeMinutes}min`);
  }

  trackSuccessfulSave(): void {
    this.saveCount++;
    console.log(`Save count: ${this.saveCount}`);
  }

  stopSessionTracking(forceUpload: boolean = false): void {
    if (!this.startTime) {
      console.warn('Tracking stop called without active tracking');
      return;
    }
  
    const endTime = new Date();
    const sessionDurationMs = endTime.getTime() - this.startTime.getTime();
    const sessionDurationMinutes = Math.round(sessionDurationMs / (1000 * 60));
    this.totalTimeMinutes += sessionDurationMinutes;
  
    localStorage.setItem(`totalTimeMinutes_${this.username}`, this.totalTimeMinutes.toString());
  
    const loginTime = this.formatTime(this.startTime);
    const logoutTime = this.formatTime(endTime);
    const date = this.formatDate(this.startTime);
  
    console.log(`Session ended: ${date}, ${loginTime} → ${logoutTime}, Duration: ${sessionDurationMinutes}min, Total: ${this.totalTimeMinutes}min, Saves: ${this.saveCount}`);
  
    const formattedCsv = `date,login_time,logout_time,duration_min,save_count\n${date},${loginTime},${logoutTime},${sessionDurationMinutes}min,${this.saveCount}`;
  
    this.startTime = null;
  
    this.uploadTrackingData(formattedCsv, forceUpload);
  }

  getSessionDuration(): Observable<string> {
    return interval(1000).pipe(
      map(() => {
        const now = new Date();
        const currentSessionMs = this.startTime ? now.getTime() - this.startTime.getTime() : 0;
        const totalMs = (this.totalTimeMinutes * 60 * 1000) + currentSessionMs;
        return this.formatDuration(totalMs);
      })
    );
  }

  private uploadTrackingData(csvData: string, forceUpload: boolean): void {
    const now = new Date();
    const filename = `tracking_${this.username}.csv`;
  
    console.log('Preparing to upload formatted tracking data:', { filename, csvData });
  
    if (forceUpload || this.saveCount > 0) {
      this.http.post(`${this.prodUrl}/upload-tracking`, { csv: csvData, filename })
        .subscribe({
          next: (response) => {
            console.log('Tracking data uploaded successfully:', response);
          },
          error: (error) => {
            console.error('Error uploading tracking data:', error);
          }
        });
    } else {
      console.log('Skipping upload - no saves recorded and not forced');
    }
  }
  
  private formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDuration(durationMs: number): string {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}