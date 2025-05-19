import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, Observable, catchError, of, throwError, shareReplay } from 'rxjs';
import { ApiResponse, ImageResponse} from '../app/interfaces'

@Injectable({
  providedIn: 'root'
})
export class AnnotationService {
  // Make sure this URL matches your backend server URL
  private cache: { [key: string]: Observable<any> } = {};
  private backendUrl = 'http://localhost:8080';
  private prodUrl = 'https://backend-268040451245.us-central1.run.app';

  constructor(private http: HttpClient) {}

  getFiles(annotatorId: string): Observable<any> {
    return this.http.get(`${this.prodUrl}/data/${annotatorId}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching files:', error);
          return of({ jsonFiles: [], imageFiles: [] });
        })
      );
  }

  getJsonData(filename: string, annotatorId?: string): Observable<any> {
    let url = `${this.prodUrl}/json/${filename}`;
    if (annotatorId) {
      url += `?annotatorId=${annotatorId}`;
    }
    return this.http.get(url)
      .pipe(
        catchError(error => {
          console.error('Error fetching JSON data:', error);
          return of({});
        })
      );
  }

  uploadJson(fileData: any, filename: string, annotatorId: string): Observable<any> {
    const url = `${this.prodUrl}/upload/${encodeURIComponent(filename)}?annotatorId=${annotatorId}`;
    return this.http.put(url, fileData).pipe(
      catchError(this.handleError)
    );
  }

  getNextImageData(annotatorId: string): Observable<any> {
    return this.http.get(`${this.prodUrl}/data/random/${annotatorId}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching random image data:', error);
          return of({ success: false, message: 'Failed to get random image' });
        })
      );
  }

  getAnnotatorProgress(annotatorId: string): Observable<any> {
    return this.http.get(`${this.prodUrl}/annotator/progress/${annotatorId}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching annotator progress:', error);
          return of({ annotated: 0, total: 0, remaining: 0, completionPercentage: '0.00' });
        })
      );
  }

  getAnnotationData(annotatorId: string): Observable<any> {
    return this.http.get(`${this.prodUrl}/api/annotations?annotatorId=${annotatorId}`)
      .pipe(
        map((response: any) => {
          if (response && response.success) {
            // Include the randomData in the returned data
            return {
              ...response.data,
              randomData: response.randomData
            };
          }
          throw new Error('Failed to retrieve annotation data');
        }),
        catchError(error => {
          console.error('Error fetching annotation data:', error);
          return of({ description: {}, imageDir: '', images: [], randomData: null });
        })
      );
    }
  
    getImageUrl(annotatorId: string, filename: string, options?: { format?: string, width?: number, quality?: number }): Observable<Blob> {
      // Build query parameters for optimization if options are provided
      let params = new HttpParams();
      if (options) {
        if (options.format) params = params.set('format', options.format);
        if (options.width) params = params.set('width', options.width.toString());
        if (options.quality) params = params.set('quality', options.quality.toString());
      }
      
      // First try the new API endpoint with optimization parameters
      const url = `${this.prodUrl}/api/images/${annotatorId}/${filename}`;
      return this.http.get(url, { 
        responseType: 'blob',
        params: params
      }).pipe(
        catchError(error => {
          console.error('Error fetching image, trying alternative endpoint:', error);
          // If that fails, try the alternative endpoint
          const fallbackUrl = `${this.prodUrl}/image/${filename}?annotatorId=${annotatorId}`;
          // Add optimization parameters to fallback URL as well
          let fallbackParams = fallbackUrl;
          if (options) {
            if (options.format) fallbackParams += `&format=${options.format}`;
            if (options.width) fallbackParams += `&width=${options.width}`;
            if (options.quality) fallbackParams += `&quality=${options.quality}`;
          }
          return this.http.get(fallbackParams, { responseType: 'blob' });
        })
      );
    }
  
  submitAnnotation(annotatorId: string, annotationData: any): Observable<any> {
    const url = `${this.prodUrl}/submit`;
    
    const payload = {
      annotatorId: annotatorId,
      annotationData: annotationData
    };
    
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
    
    console.log('Sending annotation submission:', url, payload);
    
    return this.http.post<any>(url, payload, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: any) {
    console.error('API error', error);
    
    let errorMessage = 'Unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && error.error.errorMessage) {
        errorMessage += `\nDetails: ${error.error.errorMessage}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  markAsNonRelevant(fileName: string, username: string): Observable<any> {
    return this.http.post(`${this.prodUrl}/api/mark-non-relevant`, { fileName, username });
  }  

  getDummyData(): Observable<any> {
    return this.http.get(`${this.prodUrl}/data/dummy`);
  }

  getCachedData(endpoint: string): Observable<any> {
    if (!this.cache[endpoint]) {
      this.cache[endpoint] = this.http.get(`${this.prodUrl}/${endpoint}`).pipe(
        shareReplay(1) // Cache the response
      );
    }
    return this.cache[endpoint];
  }

  clearCache(endpoint?: string) {
    if (endpoint) {
      delete this.cache[endpoint];
    } else {
      this.cache = {};
    }
  }

  saveDiscussionPoint(discussionData: any): Observable<any> {
    return this.http.post(`${this.prodUrl}/discussion/save`, discussionData);
  }

  getDiscussionPoints(): Observable<ApiResponse> {
    // Get username from localStorage - this will be passed as a route parameter
    const username = localStorage.getItem('username') || 'Guest';

    // Set headers for tracking/logging purposes
    const headers = new HttpHeaders({
      'username': username
    });

    // Pass the username as route parameter - backend will filter accordingly
    return this.http.get<ApiResponse>(`${this.prodUrl}/discussion/${username}`, { headers });
  }
  
  searchFiles(partialName: string, annotatorId: string): Observable<any> {
    const url = `${this.prodUrl}/api/search-files/${encodeURIComponent(partialName)}?annotatorId=${annotatorId}`;
    return this.http.get(url).pipe(
        catchError(error => {
            console.error('Error searching files:', error);
            return of({ success: false, data: { jsonFiles: [], imageFiles: [] } });
        })
    );
}
}