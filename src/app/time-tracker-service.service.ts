import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimeTrackerService {
  // Use environment-based URL instead of hardcoded localhost
  private backendUrl = 'http://localhost:8080';
  private prodUrl = 'https://backend-268040451245.us-central1.run.app';
  private startTime: Date | null = null;
  private totalTimeMinutes = 0;
  private saveCount = 0;
  private username = '';

  constructor(private http: HttpClient) { }

  startSessionTracking(): void {
    this.startTime = new Date();
    this.username = localStorage.getItem('username') || 'anonymous';
    this.saveCount = 0;
    console.log(`Tracking started for user: ${this.username}`);
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
    // Fix: divide by 1000 * 60 (milliseconds in a minute) instead of 1000 * 10
    const sessionDurationMinutes = Math.round(sessionDurationMs / (1000 * 60));
    this.totalTimeMinutes += sessionDurationMinutes;
  
    const loginTime = this.formatTime(this.startTime);
    const logoutTime = this.formatTime(endTime);
    const date = this.formatDate(this.startTime);
  
    console.log(`Session ended: ${date}, ${loginTime} → ${logoutTime}, Duration: ${sessionDurationMinutes}min, Saves: ${this.saveCount}`);
  
    const formattedCsv = `date,login_time,logout_time,duration_min,save_count\n${date},${loginTime},${logoutTime},${sessionDurationMinutes}min,${this.saveCount}`;
  
    // Reset tracking
    this.startTime = null;
  
    // Upload tracking data
    this.uploadTrackingData(formattedCsv, forceUpload);
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
  
}