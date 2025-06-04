import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
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
  private totalAnnotationCount = 0;
  private username = '';
  private sessionDuration$ = new BehaviorSubject<string>('00:00:00');
  private weekReset$ = new BehaviorSubject<boolean>(false); // New subject to notify reset

  constructor(private http: HttpClient) {
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    this.username = localStorage.getItem('username') || 'anonymous';
    this.checkAndResetWeeklyTime();
    const storedTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
    this.totalTimeMinutes = storedTime ? parseInt(storedTime, 10) : 0;

    const sessionStartTimeStr = localStorage.getItem(`sessionStartTime_${this.username}`);
    if (sessionStartTimeStr && this.username !== 'anonymous') {
      this.startTime = new Date(parseInt(sessionStartTimeStr, 10));
      const sessionSaveCount = localStorage.getItem(`sessionSaveCount_${this.username}`);
      this.saveCount = sessionSaveCount ? parseInt(sessionSaveCount, 10) : 0;
      const sessionTotalAnnotationCount = localStorage.getItem(`sessionTotalAnnotationCount_${this.username}`);
      this.totalAnnotationCount = sessionTotalAnnotationCount ? parseInt(sessionTotalAnnotationCount, 10) : 0;
      console.log(`Resumed session for user: ${this.username}, started at: ${this.startTime}, ` +
                  `saves: ${this.saveCount}, total annotations: ${this.totalAnnotationCount}`);
    }
  }

  private checkAndResetWeeklyTime(): void {
    const currentMondayKey = this.getCurrentMondayKey();
    const lastWeekKey = localStorage.getItem(`lastWeekReset_${this.username}`);
    
    if (lastWeekKey !== currentMondayKey) {
      // New week detected - archive and reset
      this.archiveWeeklyData();
      this.resetWeeklyTime();
      localStorage.setItem(`lastWeekReset_${this.username}`, currentMondayKey);
      this.weekReset$.next(true); // Notify subscribers of reset
      console.log(`🔄 Weekly reset completed for week starting: ${currentMondayKey}`);
    } else {
      // console.log(`No reset needed. Current week: ${currentMondayKey}`);
    }
  }

  private getCurrentMondayKey(): string {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const mondayDate = new Date(now);
    mondayDate.setDate(now.getDate() - daysFromMonday);
    mondayDate.setHours(0, 0, 0, 0); // Start of Monday
    return mondayDate.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getWeekDateRange(): { start: string, end: string } {
    const mondayKey = this.getCurrentMondayKey();
    const mondayDate = new Date(mondayKey);
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    
    return {
      start: mondayKey,
      end: sundayDate.toISOString().split('T')[0]
    };
  }

  private archiveWeeklyData(): void {
    const currentTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
    if (currentTime && parseInt(currentTime, 10) > 0) {
      const weekRange = this.getWeekDateRange();
      const archiveKey = `weeklyArchive_${this.username}_${weekRange.start}`;
      
      const weeklyData = {
        weekStart: weekRange.start,
        weekEnd: weekRange.end,
        totalMinutes: parseInt(currentTime, 10),
        archivedAt: new Date().toISOString()
      };
      
      localStorage.setItem(archiveKey, JSON.stringify(weeklyData));
      console.log(`📦 Archived week ${weekRange.start} to ${weekRange.end}: ${weeklyData.totalMinutes} minutes`);
    }
  }

  private resetWeeklyTime(): void {
    localStorage.setItem(`totalTimeMinutes_${this.username}`, '0');
    this.totalTimeMinutes = 0;
    localStorage.removeItem(`sessionStartTime_${this.username}`);
    localStorage.removeItem(`sessionSaveCount_${this.username}`);
    this.startTime = null;
    this.saveCount = 0;
    this.sessionDuration$.next('00:00:00'); // Reset displayed time
  }

  startSessionTracking(): void {
    this.checkAndResetWeeklyTime();
    this.username = localStorage.getItem('username') || 'anonymous';

    if (this.username === 'anonymous') {
      console.warn('Cannot start session tracking: No user logged in');
      return;
    }
    
    const existingSessionStart = localStorage.getItem(`sessionStartTime_${this.username}`);
    
    if (existingSessionStart && !this.startTime) {
      this.startTime = new Date(parseInt(existingSessionStart, 10));
      const existingSaveCount = localStorage.getItem(`sessionSaveCount_${this.username}`);
      this.saveCount = existingSaveCount ? parseInt(existingSaveCount, 10) : 0;
      console.log(`Resumed existing session for user: ${this.username}`);
    } else if (!this.startTime) {
      this.startTime = new Date();
      this.saveCount = 0;
      localStorage.setItem(`sessionStartTime_${this.username}`, this.startTime.getTime().toString());
      localStorage.setItem(`sessionSaveCount_${this.username}`, '0');
      console.log(`Started new session for user: ${this.username}`);
    } else {
      console.warn('Session tracking already active');
      return;
    }

    const storedTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
    this.totalTimeMinutes = storedTime ? parseInt(storedTime, 10) : 0;
    console.log(`Total time this week: ${this.totalTimeMinutes}min`);
  }
  stopSessionTracking(forceUpload: boolean = false, totalAnnotationCount: number = 0): void {
    if (!this.startTime) {
      console.warn('Tracking stop called without active tracking');
      localStorage.removeItem(`sessionStartTime_${this.username}`);
      localStorage.removeItem(`sessionSaveCount_${this.username}`);
      localStorage.removeItem(`sessionTotalAnnotationCount_${this.username}`);
      return;
    }
  
    // Update totalAnnotationCount with the passed parameter
    this.totalAnnotationCount = totalAnnotationCount;
  
    // Get the current save count from localStorage (most up-to-date)
    const sessionSaveCount = localStorage.getItem(`sessionSaveCount_${this.username}`);
    const currentSaveCount = sessionSaveCount ? parseInt(sessionSaveCount, 10) : this.saveCount;
  
    const endTime = new Date();
    const sessionDurationMs = endTime.getTime() - this.startTime.getTime();
    const sessionDurationMinutes = Math.round(sessionDurationMs / (1000 * 60));
    this.totalTimeMinutes += sessionDurationMinutes;
  
    localStorage.setItem(`totalTimeMinutes_${this.username}`, this.totalTimeMinutes.toString());
    localStorage.removeItem(`sessionStartTime_${this.username}`);
    localStorage.removeItem(`sessionSaveCount_${this.username}`);
    localStorage.removeItem(`sessionTotalAnnotationCount_${this.username}`);
  
    const loginTime = this.formatTime(this.startTime);
    const logoutTime = this.formatTime(endTime);
    const date = this.formatDate(this.startTime);
  
    console.log(`Session ended: ${date}, ${loginTime} → ${logoutTime}, ` +
                `Duration: ${sessionDurationMinutes}min, Week total: ${this.totalTimeMinutes}min, ` +
                `Saves: ${currentSaveCount}, Total annotations: ${totalAnnotationCount}`);
  
    // Updated CSV format with the correct values
    const formattedCsv = `date,login_time,logout_time,duration_min,save_count,total_annotation_count\n` +
                         `${date},${loginTime},${logoutTime},${sessionDurationMinutes},${currentSaveCount},${totalAnnotationCount}`;
  
    this.startTime = null;
    this.saveCount = 0;
    this.totalAnnotationCount = 0;
    this.sessionDuration$.next('00:00:00');
    
    // 🔥 Pass the actual values to uploadTrackingData instead of using stale internal properties
    this.uploadTrackingDataWithValues(formattedCsv, forceUpload, currentSaveCount, totalAnnotationCount);
  }
  
  // New method that takes the actual values as parameters
  private uploadTrackingDataWithValues(csvData: string, forceUpload: boolean, saveCount: number, totalAnnotationCount: number): void {
    const filename = `tracking_${this.username}.csv`;
    console.log('Preparing to upload formatted tracking data:', { filename, csvData });
  
    // Debug logging to see actual values
    console.log('Upload check:', { 
      forceUpload, 
      saveCount, 
      totalAnnotationCount 
    });
  
    // Upload if ANY of these conditions are true:
    const shouldUpload = forceUpload || saveCount > 0 || totalAnnotationCount > 0;
    
    if (!shouldUpload) {
      console.log('❌ Skipping upload - no activity detected (both save count and total annotation count are zero)');
      return;
    }
    
    console.log('✅ Uploading tracking data - activity detected:', {
      reason: forceUpload ? 'forced' : 
             saveCount > 0 ? `${saveCount} saves` : 
             `${totalAnnotationCount} annotations`
    });
  
    this.http.post(`${this.prodUrl}/upload-tracking`, { csv: csvData, filename })
      .subscribe({
        next: (response) => {
          console.log('Tracking data uploaded successfully:', response);
        },
        error: (error) => {
          console.error('Error uploading tracking data:', error);
        }
      });
  }
  
  // Keep the old method for backward compatibility, but make it use the new logic
  private uploadTrackingData(csvData: string, forceUpload: boolean): void {
    this.uploadTrackingDataWithValues(csvData, forceUpload, this.saveCount, this.totalAnnotationCount);
  }

  // Method to update totalAnnotationCount during session
  updateAnnotationCount(totalAnnotationCount: number): void {
    this.totalAnnotationCount = totalAnnotationCount;
    localStorage.setItem(`sessionTotalAnnotationCount_${this.username}`, this.totalAnnotationCount.toString()); // Fix typo
    console.log(`Updated total annotation count: ${this.totalAnnotationCount}`);
  }

  logout(totalAnnotationCount: number = 0): void {
    if (this.startTime) {
      this.stopSessionTracking(false, totalAnnotationCount);
      console.log(`User ${this.username} logged out, session tracking stopped.`);
    } else {
      localStorage.removeItem(`sessionStartTime_${this.username}`);
      localStorage.removeItem(`sessionSaveCount_${this.username}`);
      localStorage.removeItem(`sessionTotalAnnotationCount_${this.username}`);
      console.log(`User ${this.username} logged out, session data cleared.`);
    }
    this.username = '';
  }

  // Update trackSuccessfulSave to handle totalAnnotationCount
  trackSuccessfulSave(totalAnnotationCount: number = 0): void {
    this.saveCount++;
    this.totalAnnotationCount = totalAnnotationCount;
    localStorage.setItem(`sessionSaveCount_${this.username}`, this.saveCount.toString());
    localStorage.setItem(`sessionTotalAnnotationCount_${this.username}`, this.totalAnnotationCount.toString());
    console.log(`Save count: ${this.saveCount}, Total annotations: ${this.totalAnnotationCount}`);
  }

  getSessionDuration(): Observable<string> {
    return interval(1000).pipe(
      map(() => {
        this.checkAndResetWeeklyTime();
        const currentUsername = localStorage.getItem('username') || 'anonymous';

        if (!currentUsername || !this.isSessionActive()) {
          return '00:00:00';
        }

        if (currentUsername !== this.username) {
          this.username = currentUsername;
          const storedTime = localStorage.getItem(`totalTimeMinutes_${this.username}`);
          this.totalTimeMinutes = storedTime ? parseInt(storedTime, 10) : 0;
        }

        const now = new Date();
        let currentSessionMs = 0;

        if (!this.startTime) {
          const sessionStartTimeStr = localStorage.getItem(`sessionStartTime_${this.username}`);
          if (sessionStartTimeStr) {
            this.startTime = new Date(parseInt(sessionStartTimeStr, 10));
          }
        }

        if (this.startTime) {
          currentSessionMs = now.getTime() - this.startTime.getTime();
        }

        const totalMs = (this.totalTimeMinutes * 60 * 1000) + currentSessionMs;
        return this.formatDuration(totalMs);
      })
    );
  }

  getWeekResetObservable(): Observable<boolean> {
    return this.weekReset$.asObservable();
  }

  getCurrentWeekInfo(): { start: string, end: string, isNewWeek: boolean } {
    const range = this.getWeekDateRange();
    const lastWeekKey = localStorage.getItem(`lastWeekReset_${this.username}`);
    return {
      ...range,
      isNewWeek: lastWeekKey !== range.start
    };
  }

  getWeeklyArchives(): Array<{ weekStart: string, weekEnd: string, totalMinutes: number, archivedAt: string }> {
    const archives: Array<any> = [];
    const username = this.username || 'anonymous';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`weeklyArchive_${username}_`)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            archives.push(JSON.parse(data));
          } catch (e) {
            console.error('Error parsing archived week data:', e);
          }
        }
      }
    }
    
    return archives.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  }

  forceWeeklyReset(): void {
    console.log('🔧 Force resetting weekly timer...');
    this.archiveWeeklyData();
    this.resetWeeklyTime();
    localStorage.setItem(`lastWeekReset_${this.username}`, this.getCurrentMondayKey());
    this.weekReset$.next(true); // Notify reset
  }

  isMonday(): boolean {
    return new Date().getDay() === 1;
  }

  getDaysUntilReset(): number {
    const today = new Date().getDay();
    if (today === 1) return 7;
    return today === 0 ? 1 : 8 - today;
  }

  isSessionActive(): boolean {
    const sessionStartTimeStr = localStorage.getItem(`sessionStartTime_${this.username || 'anonymous'}`);
    return !!sessionStartTimeStr || !!this.startTime;
  }

  getCurrentSessionDurationMs(): number {
    if (!this.startTime) {
      const sessionStartTimeStr = localStorage.getItem(`sessionStartTime_${this.username}`);
      if (sessionStartTimeStr) {
        return Date.now() - parseInt(sessionStartTimeStr, 10);
      }
      return 0;
    }
    return Date.now() - this.startTime.getTime();
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
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    
    if (hours > 999) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}