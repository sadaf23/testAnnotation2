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
    const sessionDurationMinutes = sessionDurationMs / (1000 * 60);
    this.totalTimeMinutes += sessionDurationMinutes;

    console.log(`Session ended, duration: ${sessionDurationMinutes.toFixed(2)} minutes`);
    console.log(`Total time: ${this.totalTimeMinutes.toFixed(2)} minutes`);
    console.log(`Total saves: ${this.saveCount}`);

    // Reset tracking
    this.startTime = null;

    // Upload tracking data to server
    this.uploadTrackingData(forceUpload);
  }

  private uploadTrackingData(forceUpload: boolean): void {
    // Create CSV data
    const now = new Date();
    const timestamp = now.toISOString();
    const csvData = `timestamp,username,duration_minutes,save_count\n${timestamp},${this.username},${this.totalTimeMinutes.toFixed(2)},${this.saveCount}`;
    
    // Generate unique filename
    const filename = `tracking_${this.username}_${now.getTime()}.csv`;
    
    console.log('Preparing to upload tracking data:', { filename, csvData });
    
    // Always upload on forceUpload or if there are saves
    if (forceUpload || this.saveCount > 0) {
      this.http.post(`${this.prodUrl}/upload-tracking`, { csv: csvData, filename: filename })
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
}