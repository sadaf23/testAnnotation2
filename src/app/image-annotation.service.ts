import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { combineLatest, map, Observable, of, shareReplay, tap } from 'rxjs';
import { catchError, retry, throwError } from 'rxjs';
import { AnnotationData, AnnotationResponse, AnnotationStats } from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class ImageAnnotationService {
  private backendUrl = 'http://localhost:8080';
  private prodBaseUrl = 'https://backend-268040451245.us-central1.run.app';
  private httpOptions = { headers: { 'Content-Type': 'application/json' } };
  private cachedImages$: Observable<{ patientId: string; images: { name: string; url: string }[] }[]> | null = null;
  private cachedStats$: Observable<AnnotationResponse> | null = null;

  constructor(private http: HttpClient) {}

  clearImageCache(): void {
    this.cachedImages$ = null;
    console.log('[ImageAnnotationService] Image cache cleared');
  }

  clearStatsCache(): void {
    this.cachedStats$ = null;
    console.log('[ImageAnnotationService] Stats cache cleared');
  }

  getAllPatientImages(page: number = 1, pageSize: number = 10): Observable<{ patientId: string; images: { name: string; url: string }[] }[]> {
    if (!this.cachedImages$) {
      const username = this.getCurrentUsername();
      const url = `${this.prodBaseUrl}/api/patient-images/all?username=${encodeURIComponent(username)}&page=${page}&pageSize=${pageSize}`;
      const images$ = this.http.get<{ success: boolean; data: { images: { name: string; url: string; patientId: string }[] } }>(url)
        .pipe(
          retry({ count: 2, delay: 500 }),
          map(response => {
            if (!response.success || !response.data.images.length) {
              throw new Error('No unannotated images available. All images are assigned or completed.');
            }
            const groupedImages: { [key: string]: { name: string; url: string }[] } = {};
            response.data.images.forEach(image => {
              if (!groupedImages[image.patientId]) {
                groupedImages[image.patientId] = [];
              }
              groupedImages[image.patientId].push({ name: image.name, url: image.url });
            });
            return Object.keys(groupedImages)
              .sort()
              .map(patientId => ({
                patientId,
                images: groupedImages[patientId]
              }));
          }),
          catchError(error => {
            console.error('[ImageAnnotationService] Error fetching images:', error);
            return throwError(() => error);
          })
        );

      const annotatedFiles$ = this.getAnnotatedFiles();
      this.cachedImages$ = combineLatest([images$, annotatedFiles$]).pipe(
        map(([patients, annotatedFiles]: [
          { patientId: string; images: { name: string; url: string }[] }[],
          string[]
        ]) => {
          const annotatedFilesSet = new Set(annotatedFiles);
          return patients.map(patient => ({
            patientId: patient.patientId,
            images: patient.images.filter(image => !annotatedFilesSet.has(image.name))
          })).filter(patient => patient.images.length > 0);
        }),
        shareReplay(1)
      );
    }
    return this.cachedImages$;
  }

  saveAnnotation(annotationData: AnnotationData): Observable<AnnotationResponse> {
    // Validate PatientId format
    if (!/^\d{17}$/.test(annotationData.patientId)) {
      console.error('[ImageAnnotationService] Invalid PatientId format:', annotationData.patientId);
      return throwError(() => new Error('PatientId must be a 17-digit number'));
    }
  
    const url = `${this.prodBaseUrl}/api/save-annotation`;
    const headers = ['PatientId', 'FileName', 'Legible', 'Non-Legible', 'blurry', 'dark', 'obstructed', 'quality', 'incomplete', 'other', 'Username'];
    const row = [
      annotationData.patientId,
      annotationData.fileName,
      annotationData.legible ? '1' : '0',
      annotationData.nonLegible ? '1' : '0',
      annotationData.checklistItems?.blurry ? '1' : '0',
      annotationData.checklistItems?.dark ? '1' : '0',
      annotationData.checklistItems?.obstructed ? '1' : '0',
      annotationData.checklistItems?.quality ? '1' : '0',
      annotationData.checklistItems?.incomplete ? '1' : '0',
      annotationData.checklistItems?.other ? '1' : '0',
      annotationData.username
    ];
    const escapeCsvValue = (value: string) => {
      // Always quote to prevent numeric interpretation
      return `"${value.replace(/"/g, '""')}"`;
    };
    // Use unquoted header to match server expectation
    const csvHeader = headers.join(',');
    const csvRow = row.map(escapeCsvValue).join(',');
    const csvData = `${csvHeader}\n${csvRow}`;
    return this.http.post<AnnotationResponse>(url, { csv: csvData, filename: `image_annotations.csv` }, this.httpOptions)
      .pipe(
        retry({ count: 2, delay: 500 }),
        catchError(error => {
          console.error('[ImageAnnotationService] Error saving annotation:', error);
          if (error.status === 400) {
            if (error.error.message.includes('Duplicate annotation')) {
              return throwError(() => new Error('This image has already been annotated by you. Please move to the next image.'));
            }
            if (error.error.message.includes('Invalid PatientId format')) {
              return throwError(() => new Error('Invalid PatientId format. Please ensure the Patient ID is a 17-digit number.'));
            }
            if (error.error.message.includes('CSV header mismatch')) {
              return throwError(() => new Error('CSV header format is incorrect. Please contact support.'));
            }
          }
          return throwError(() => error);
        })
      );
  }

  createAnnotationData(
    patientId: string,
    fileName: string,
    legible: boolean,
    nonLegible: boolean,
    checklistItems: { id: string; selected: boolean }[] | { [key: string]: boolean },
    username: string
  ): AnnotationData {
    const checklistObj = Array.isArray(checklistItems)
      ? checklistItems.reduce((acc, item) => ({
          ...acc,
          [item.id]: item.selected
        }), {} as { [key: string]: boolean })
      : checklistItems;

    return {
      patientId,
      fileName,
      legible,
      nonLegible,
      checklistItems: checklistObj,
      username
    };
  }

  validateAnnotationData(annotationData: AnnotationData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!annotationData.patientId) errors.push('Patient ID is required');
    if (!annotationData.fileName) errors.push('File name is required');
    if (!annotationData.username) errors.push('Username is required');
    if (!annotationData.legible && !annotationData.nonLegible) {
      errors.push('Image must be marked as legible or non-legible');
    }
    if (annotationData.nonLegible) {
      const checklistSelected = Object.values(annotationData.checklistItems || {}).some(val => val);
      if (!checklistSelected) {
        errors.push('At least one checklist item must be selected for non-legible images');
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  saveAnnotationsBatch(annotations: Omit<AnnotationData, 'username'>[], username: string): Observable<AnnotationResponse> {
    console.warn('[ImageAnnotationService] saveAnnotationsBatch not implemented');
    return throwError(() => new Error('Batch annotation saving not implemented'));
  }

  getAnnotationStats(): Observable<{ success: boolean; stats: AnnotationStats }> {
    console.log('[ImageAnnotationService] Fetching annotation stats');
    return of({
      success: true,
      stats: { totalAnnotations: 0, legibleCount: 0, nonLegibleCount: 0 }
    });
  }

  getAnnotatedFiles(): Observable<string[]> {
    const url = `${this.prodBaseUrl}/api/annotated-files`;
    return this.http.get<{ success: boolean; data: string[] }>(url).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Failed to fetch annotated files');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('[ImageAnnotationService] Error fetching annotated files:', error);
        return of([]); // Return empty array on error to prevent blocking
      })
    );
  }

  getCurrentUsername(): string {
    return localStorage.getItem('username') || 'anonymous_user';
  }

  setCurrentUsername(username: string): void {
    localStorage.setItem('username', username);
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      }
    }
    console.error('AnnotationService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  validateAnnotationsBatch(annotations: AnnotationData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!annotations || annotations.length === 0) {
      errors.push('No annotations provided');
      return { isValid: false, errors };
    }
    annotations.forEach((annotation, index) => {
      const validation = this.validateAnnotationData(annotation);
      if (!validation.isValid) {
        errors.push(`Annotation ${index + 1}: ${validation.errors.join(', ')}`);
      }
    });
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}