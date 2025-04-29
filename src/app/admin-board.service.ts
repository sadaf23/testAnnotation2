import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, shareReplay } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface FileCountResponse {
  totalFiles: number;
  annotatedFiles: number;
  annotatedByCounts: {
    [annotator: string]: number;}
  totalNonRelevantFiles: number;
}

export interface DailySaveCountResponse {
  success: boolean;
  data: Array<{
    user: string;
    dailySaveCounts: Array<{ date: string; count: number }>;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AdminBoardService {
  private cache: { [key: string]: Observable<any> } = {};

  // Base URLs for development and production
  private devBaseUrl = 'http://localhost:8080';
  private prodBaseUrl = 'https://backend-268040451245.us-central1.run.app';

  // Determine the base URL based on the environment
  private baseUrl = window.location.hostname === 'localhost' ? this.devBaseUrl : this.prodBaseUrl;

  // Endpoint paths
  private fileCountsEndpoint = '/api/count-files';
  private dailySaveCountsEndpoint = '/daily-save-count';

  constructor(private http: HttpClient) {}

  getFileCounts(): Observable<FileCountResponse> {
    const cacheKey = 'fileCounts';
    if (!this.cache[cacheKey]) {
      const url = `${this.prodBaseUrl}${this.fileCountsEndpoint}`;
      this.cache[cacheKey] = this.http.get<FileCountResponse>(url).pipe(
        shareReplay(1),
        catchError(this.handleError)
      );
    }
    return this.cache[cacheKey];
  }

  getDailySaveCounts(): Observable<DailySaveCountResponse> {
    const cacheKey = 'dailySaveCounts';
    if (!this.cache[cacheKey]) {
      const url = `${this.prodBaseUrl}${this.dailySaveCountsEndpoint}`;
      this.cache[cacheKey] = this.http.get<DailySaveCountResponse>(url).pipe(
        shareReplay(1),
        catchError(this.handleError)
      );
    }
    return this.cache[cacheKey];
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Error fetching data:', error);
    let errorMessage = 'Failed to load data';
    if (error.status === 0) {
      errorMessage = 'Network error: Unable to reach the server';
    } else if (error.error instanceof SyntaxError) {
      errorMessage = 'Server returned invalid JSON';
    } else if (error.status >= 400) {
      errorMessage = `Server error: ${error.status} - ${error.statusText}`;
    }
    return throwError(() => new Error(errorMessage));
  }

  // Method to clear cache if needed (e.g., after data refresh)
  clearCache(): void {
    this.cache = {};
  }
}