import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnnotationService } from '../annotation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker-service.service';
import { AuthService } from '../auth.service';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { AdminBoardService, FileCountResponse } from '../admin-board.service';

interface AnnotatedData {
  [key: string]: any;
}

interface ImageOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  quality?: number;
}

interface AnnotatorCount {
  name: string;
  count: number;
}

@Component({
  selector: 'app-annotation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './annotation.component.html',
  styleUrls: ['./annotation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationComponent implements OnInit, OnDestroy {
  
  jsonData: any = {};
  imageUrl: string = '';
  assignedJsonFile: string  = '';
  assignedImageFile: string  = '';
  currentIndex = 0;
  dataList: any[] = [];
  jsonKeyValues: { key: string; value: string }[] = [];
  username: string = '';
  annotatorId: string ='';
  progress: { annotated: number, total: number, remaining: number, completionPercentage?: string } = {
    annotated: 0,
    total: 0,
    remaining: 0,
  };
  additionalObservation: string = '';
  additionalDiagnosis: string = '';
  annotatedby: string = '';
  annotationData: any = {};
  currentImageIndex: number = 0;
  images: string[] = [];
  loading: boolean = true;
  error: string | null = null;
  randomData: any = null;
  progressData: any;
  isZoomed = false;
  nextAnnotationData: any = null;
  preloadedImages: Map<string, string> = new Map();
  private subscriptions = new Subscription();
  private isSlowConnection: boolean = false;
  private textareasResized = false;
  historyStack: any[] = [];
  currentHistoryIndex = -1;
  sessionAnnotationCount: number = 0;
  dailyAnnotationCount: number = 0;
  lastAnnotationDate: string = '';  
  imageLoading: boolean = true;
  saveButtonActive: boolean = false;
  imageLoaded: boolean = false;
  descriptionLoaded: boolean = false;

  // Image dimensions for layout stability
  imageWidth: number = 800;
  imageHeight: number = 600;
  
  counts: FileCountResponse | null = null;
  currentAnnotatorCount: number = 0;

  private createdBlobUrls: string[] = [];
  pendingSaves: Map<string, boolean> = new Map();
  lastSavedAnnotation: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService, 
    private annotationService: AnnotationService, 
    private http: HttpClient, 
    private timeTracker: TimeTrackerService,
    private changeDetector: ChangeDetectorRef,
    private adminBoardService: AdminBoardService
  ) {
    // Check connection quality if available
    this.checkConnectionSpeed();
  }

  ngOnInit() {
    console.log('Fetching Annotator ID from localStorage...');
    this.annotatorId = localStorage.getItem('annotatorId') || 'general';
    console.log('Fetched Annotator ID:', this.annotatorId);
    this.username = localStorage.getItem('username') || 'Guest';

    this.timeTracker.startSessionTracking();

    const routeSubscription = this.route.params.subscribe(params => {
      if (params['id']) {
        this.annotatorId = params['id'];
        localStorage.setItem('annotatorId', this.annotatorId);
      }
      console.log('Using annotator ID:', this.annotatorId);
      this.loadAllData();
    });

    this.checkPendingSaves();
    this.subscriptions.add(routeSubscription);
    this.loadDailyAnnotationCount();
    this.fetchFileCounts();
  }

  ngAfterViewChecked(): void {
    if (!this.textareasResized) {
      this.resizeAllTextareas();
      this.textareasResized = true; // Prevent repeat
    }
  }

  checkConnectionSpeed(): void {
    // Use Navigator connection API if available
    const connection = (navigator as any).connection;
    if (connection) {
      this.isSlowConnection = connection.saveData || 
        (connection.effectiveType && 
         (connection.effectiveType.includes('2g') || connection.effectiveType.includes('slow')));
      
      console.log(`Connection status: ${this.isSlowConnection ? 'slow' : 'fast'}`);
    }
  }

  toggleZoom(): void {
    this.isZoomed = !this.isZoomed;
    this.changeDetector.detectChanges();
  }

  loadAllData(): void {
    this.loading = true;
    this.error = null;
    
    // Save annotator ID to localStorage for persistence
    localStorage.setItem('annotatorId', this.annotatorId);
    
    this.loadDailyAnnotationCount();
    // Load annotation data and progress data in parallel
    this.loadAnnotationData();
  }
  
  loadAnnotationData(preloadedData?: any): void {
    this.loading = true;
    this.error = null;
  
    if (preloadedData) {
      console.log('Using preloaded annotation data.');
      this.setAnnotationData(preloadedData);
      this.loading = false;
      // Preload the next data immediately
      this.preloadNextAnnotation();
      this.changeDetector.markForCheck();
      return;
    }
  
    const dataSubscription = forkJoin([
      this.annotationService.getAnnotationData(this.annotatorId),
      this.annotationService.getAnnotatorProgress(this.annotatorId)
    ]).subscribe({
      next: ([annotationData, progressData]) => {
        this.setAnnotationData(annotationData);
        this.progress = progressData;
        this.loading = false;
        this.preloadNextAnnotation();
        this.changeDetector.markForCheck();
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.error = 'Failed to load data. Please try again.';
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
    setTimeout(() => {
      const allTextareas = document.querySelectorAll('textarea');
      allTextareas.forEach((ta) => {
        (ta as HTMLTextAreaElement).style.height = 'auto';
        (ta as HTMLTextAreaElement).style.height = (ta as HTMLTextAreaElement).scrollHeight + 'px';
      });
    }, 100);
    
    
    this.subscriptions.add(dataSubscription);
  }

  setAnnotationData(data: any): void {
    this.annotationData = data;
    this.textareasResized = false;
  
    if (this.currentHistoryIndex === -1 || this.historyStack[this.currentHistoryIndex]?.filename !== data.filename) {
      this.historyStack.push(data);
      this.currentHistoryIndex = this.historyStack.length - 1;
    }
  
    this.annotationData = data;
  
    if (data && data.description) {
      this.jsonKeyValues = Object.entries(data.description).map(
        ([key, value]) => ({ key, value: String(value) })
      );
      this.jsonData = { ...data.description };
    }
  
    if (data.randomData) {
      this.randomData = data.randomData;
      this.assignedJsonFile = data.randomData.jsonFiles?.[0] || '';
      this.assignedImageFile = data.randomData.imageFiles?.[0] || '';
    }
  
    if (data.images && data.images.length > 0) {
      this.images = data.images;
      this.loadImageData(this.images[0]);
    }
    
    // Mark description as loaded
    this.descriptionLoaded = true;
    this.checkLoadingComplete();
  }

  resizeAllTextareas() {
    const allTextareas = document.querySelectorAll('textarea');
    allTextareas.forEach((ta) => {
      const el = ta as HTMLTextAreaElement;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }

  preloadNextAnnotation(): void {
    // Skip preloading if on a slow connection
    if (this.isSlowConnection) {
      console.log('Skipping preload due to slow connection');
      return;
    }
    
    const preloadSubscription = this.annotationService.getAnnotationData(this.annotatorId).subscribe({
      next: (data) => {
        this.nextAnnotationData = data;
        console.log('Preloaded next annotation data.');

        if (data && data.images && data.images.length > 0) {
          // Only preload the first image to reduce network load
          this.preloadNextImages([data.images[0]]);
        }
      },
      error: (err) => {
        console.warn('Failed to preload next annotation data:', err);
        this.nextAnnotationData = null;
      }
    });
    
    this.subscriptions.add(preloadSubscription);
  }
  
  preloadNextImages(imageNames: string[]): void {
    if (!imageNames || imageNames.length === 0 || this.isSlowConnection) {
      return;
    }
    
    console.log(`Starting preload of primary image for next annotation.`);
    
    // Only preload the first image to conserve bandwidth
    const imageName = imageNames[0];
    
    const imageSubscription = this.annotationService.getImageUrl(
      this.annotatorId, 
      imageName,
      {
        format: 'webp',
        width: this.getOptimalImageWidth(),
        quality: 80
      }
    ).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.preloadedImages.set(imageName, url);
        console.log(`Preloaded primary image: ${imageName}`);
      },
      error: (err) => {
        console.warn(`Failed to preload primary image ${imageName}:`, err);
      }
    });
    
    this.subscriptions.add(imageSubscription);
  }
  
  getOptimalImageWidth(): number {
    // Return appropriate size based on screen width
    const screenWidth = window.innerWidth;
    if (screenWidth <= 768) return 600; // Mobile
    if (screenWidth <= 1200) return 800; // Tablet
    return 1200; // Desktop
  }

  loadImageData(imageName: string): void {
    this.imageLoading = true;
    
    // Check if this image was preloaded
    const preloadedUrl = this.preloadedImages.get(imageName);
    
    if (preloadedUrl) {
      console.log(`Using preloaded image for ${imageName}`);
      // Add to tracking array for cleanup
      this.createdBlobUrls.push(preloadedUrl);
      this.imageUrl = preloadedUrl;
      // Remove from the preloaded map to free memory
      this.preloadedImages.delete(imageName);
      
      // Create a temporary image to check when it's loaded
      const img = new Image();
      img.onload = () => {
        this.imageLoading = false;
        this.imageLoaded = true;
        this.checkLoadingComplete();
        this.changeDetector.markForCheck();
      };
      img.src = this.imageUrl;
      
      this.changeDetector.markForCheck();
    } else {
      // Fall back to regular loading if not preloaded
      console.log(`Image ${imageName} not preloaded, loading optimized version`);
      
      const imageSubscription = this.annotationService.getImageUrl(
        this.annotatorId, 
        imageName,
        {
          format: 'webp',
          width: this.getOptimalImageWidth(),
          quality: 80
        }
      ).subscribe({
        next: (blob) => {
          // Revoke old URL if it exists to prevent memory leaks
          if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.imageUrl);
          }
          
          const blobUrl = URL.createObjectURL(blob);
          // Add to tracking array
          this.createdBlobUrls.push(blobUrl);
          this.imageUrl = blobUrl;
          
          // Create a temporary image to check when it's loaded
          const img = new Image();
          img.onload = () => {
            this.imageLoading = false;
            this.imageLoaded = true;
            this.checkLoadingComplete();
            this.changeDetector.markForCheck();
          };
          img.src = this.imageUrl;
          
          this.changeDetector.markForCheck();
        },
        error: (err) => {
          console.error('Error loading image:', err);
          this.error = 'Failed to load image. Please try again.';
          this.imageLoading = false;
          this.checkLoadingComplete();
          this.changeDetector.markForCheck();
        }
      });
      
      this.subscriptions.add(imageSubscription);
    }
  }

  checkLoadingComplete(): void {
    if (this.imageLoaded && this.descriptionLoaded) {
      // Reset the button state when everything is loaded
      this.saveButtonActive = false;
      this.changeDetector.markForCheck();
    }
  }
  
  nextImage(): void {
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
      this.loadImageData(this.images[this.currentImageIndex]);
    }
  }
  
  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.loadImageData(this.images[this.currentImageIndex]);
    }
  }
  
  getAnnotatorProgress() {
    if (!this.annotatorId) {
      console.error('Annotator ID is not set.');
      return;
    }

    const progressSubscription = this.annotationService.getAnnotatorProgress(this.annotatorId).subscribe({
      next: (progress) => {
        console.log('Annotator progress:', progress);
        this.progress = progress;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching annotator progress:', error);
      }
    });
    
    this.subscriptions.add(progressSubscription);
  }

  loadJsonData(filename: string) {
    const baseFilename = filename.split('/').pop();
    if (!baseFilename) {
      console.error('Invalid filename format');
      return;
    }

    const jsonSubscription = this.annotationService.getJsonData(baseFilename, this.annotatorId || undefined).subscribe({
      next: (data) => {
        console.log('JSON data loaded:', data);
        this.jsonData = data;
        
        // Create key-value pairs for display
        this.jsonKeyValues = Object.entries(this.jsonData).map(([key, value]) => ({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value)
        }));
        
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        console.error('Error loading JSON data:', error);
      }
    });
    
    this.subscriptions.add(jsonSubscription);
  }

  saveAnnotation() {
    if (!this.jsonData || !this.assignedJsonFile || !this.annotatorId) {
      console.error('Missing data for saving annotation');
      return;
    }
  
    this.jsonData.additionalDiagnosis = this.additionalDiagnosis;
    this.jsonData.additionalObservation = this.additionalObservation;
    this.jsonData.annotatedby = this.username; // Store the annotator's username
  
    const baseFilename = this.assignedJsonFile.split('/').pop() || '';
    const annotatedFilename = baseFilename;
  
    console.log(`Saving annotation as: ${annotatedFilename} by annotator: ${this.username}`);
  
    const saveSubscription = this.annotationService.uploadJson(this.jsonData, annotatedFilename, this.annotatorId)
      .subscribe({
        next: (response) => {
          console.log('Annotation saved successfully:', response);
          
          // Track successful save only after confirmed success
          this.timeTracker.trackSuccessfulSave();
  
          this.additionalDiagnosis = '';
          this.additionalObservation = '';
  
          // Fetch updated progress only after a successful save
          this.getAnnotatorProgress();
          
          // Load new annotation data
          this.loadAnnotationData();
        },
        error: (error) => {
          console.error('Error saving annotation:', error);
        }
      });
    
    this.subscriptions.add(saveSubscription);
  }
  
  loadDailyAnnotationCount() {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const storedDate = localStorage.getItem('lastAnnotationDate');
    
    if (storedDate === today) {
      // Still the same day, use the stored count
      this.dailyAnnotationCount = parseInt(localStorage.getItem('dailyAnnotationCount') || '0', 10);
    } else {
      // New day, reset the count
      this.dailyAnnotationCount = 0;
      localStorage.setItem('lastAnnotationDate', today);
      localStorage.setItem('dailyAnnotationCount', '0');
    }
  }
  
  saveAndNext() {
    // Check if already processing to prevent double submissions
    if (this.saveButtonActive) {
      console.log('Save in progress, please wait');
      return;
    }
    
    // Set button to active state
    this.saveButtonActive = true;
    this.imageLoaded = false;
    this.descriptionLoaded = false;
    this.changeDetector.markForCheck();
    
    // Generate a unique save ID to track this specific save operation
    const saveId = `save_${Date.now()}`;
    this.pendingSaves.set(saveId, true);
    
    // Add a timeout to reset UI if submission takes too long
    const timeoutId = setTimeout(() => {
      if (this.pendingSaves.get(saveId)) {
        console.warn('Save operation timed out after 30 seconds');
        this.saveButtonActive = false;
        this.changeDetector.markForCheck();
        
        // Show a more detailed alert with options
        if (confirm('The save operation is taking longer than expected. Would you like to wait longer? (OK to wait, Cancel to abort)')) {
          // User wants to wait longer - add another 30 seconds
          const extendedTimeoutId = setTimeout(() => {
            if (this.pendingSaves.get(saveId)) {
              this.pendingSaves.delete(saveId);
              alert('Save operation could not complete. Please check network connection and try again.');
              this.saveButtonActive = false;
              this.changeDetector.markForCheck();
            }
          }, 30000);
          
          this.subscriptions.add({
            unsubscribe: () => clearTimeout(extendedTimeoutId)
          });
        } else {
          // User doesn't want to wait - mark this save as aborted
          this.pendingSaves.delete(saveId);
          alert('Save operation aborted. Your changes were not saved. Please try again.');
          this.saveButtonActive = false;
          this.changeDetector.markForCheck();
        }
      }
    }, 30000); // 30 second timeout
    
    // Add timeout to subscription for cleanup
    this.subscriptions.add({
      unsubscribe: () => clearTimeout(timeoutId)
    });
    
    // Get current annotation ID for tracking
    const currentAnnotationId = this.getAnnotationIdentifier();
    
    // Call the improved submit method with tracking
    this.submitAnnotationWithTracking(this.jsonData, saveId, currentAnnotationId);
  }

  getAnnotationIdentifier(): string {
    // Create a unique ID for the current annotation
    if (this.annotationData && this.annotationData.filename) {
      return this.annotationData.filename;
    } else if (this.assignedJsonFile) {
      const parts = this.assignedJsonFile.split('/');
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }
    return `annotation_${Date.now()}`;
  }
  
  submitAnnotationWithTracking(annotationData: any, saveId: string, annotationId: string): void {
    // Required field validation, metadata setting, etc. (existing code)...
    
    console.log(`Submitting annotation ${annotationId} with tracking ID ${saveId}`);
    
    const submitSubscription = this.annotationService.submitAnnotation(this.annotatorId, this.jsonData)
      .subscribe({
        next: (response) => {
          console.log(`Annotation ${annotationId} submitted successfully with tracking ID ${saveId}`);
          
          // Mark this save as completed
          this.pendingSaves.delete(saveId);
          this.lastSavedAnnotation = annotationId;
          
          // Store in session storage for persistence
          try {
            sessionStorage.setItem('lastSavedAnnotation', annotationId);
            sessionStorage.setItem('lastSaveTime', new Date().toISOString());
          } catch (e) {
            console.warn('Could not store save info in session storage:', e);
          }
          
          // Show success with annotation ID
          this.showSuccessPopup(`Annotation ${annotationId} saved successfully`);
          
          // Reset UI state
          this.saveButtonActive = false;
          
          // Proceed with loading next annotation
          this.timeTracker.trackSuccessfulSave();
          this.additionalDiagnosis = '';
          this.additionalObservation = '';
          this.getAnnotatorProgress();
          this.updateAnnotationCounts();
          
          try {
            if (this.nextAnnotationData) {
              this.loadAnnotationData(this.nextAnnotationData);
              this.nextAnnotationData = null;
            } else {
              this.loadAnnotationData();
            }
          } catch (error) {
            console.error('Error loading next annotation:', error);
            this.saveButtonActive = false;
            this.imageLoaded = true;
            this.descriptionLoaded = true;
            alert('Error loading next annotation. Please refresh the page.');
          }
          
          this.changeDetector.markForCheck();
        },
        error: (err) => {
          console.error(`Error submitting annotation ${annotationId} with tracking ID ${saveId}:`, err);
          
          // Mark this save as failed
          this.pendingSaves.delete(saveId);
          
          alert(`Error saving annotation ${annotationId}: ${err.message || 'Unknown error'}`);
          
          // Reset UI state
          this.saveButtonActive = false;
          this.imageLoaded = true;
          this.descriptionLoaded = true;
          this.changeDetector.markForCheck();
        }
      });
    
    this.subscriptions.add(submitSubscription);
  }
  
  updateAnnotationCounts(): void {
    this.sessionAnnotationCount++;
    this.dailyAnnotationCount++;
    
    // Store updated daily count in localStorage
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('lastAnnotationDate', today);
    localStorage.setItem('dailyAnnotationCount', this.dailyAnnotationCount.toString());
  }
  
  // 6. Add a verification method to check if an annotation was saved
  checkIfSaved(annotationId: string): boolean {
    return this.lastSavedAnnotation === annotationId || 
           sessionStorage.getItem('lastSavedAnnotation') === annotationId;
  }
  
  // 7. Add a method to check pending saves on component initialization
  checkPendingSaves(): void {
    const lastSavedAnnotation = sessionStorage.getItem('lastSavedAnnotation');
    const lastSaveTime = sessionStorage.getItem('lastSaveTime');
    
    if (lastSavedAnnotation && lastSaveTime) {
      const saveTime = new Date(lastSaveTime);
      const currentTime = new Date();
      const timeDiff = (currentTime.getTime() - saveTime.getTime()) / 1000; // in seconds
      
      if (timeDiff < 600) { // If save was in the last 10 minutes
        console.log(`Last saved annotation was ${lastSavedAnnotation} at ${saveTime.toLocaleTimeString()}`);
        this.lastSavedAnnotation = lastSavedAnnotation;
      }
    }
  }
  

  submitAnnotation(annotationData: any): void {
    // Required field keys to validate
    const requiredFields = [
      'type_of_lesion',
      'site',
      'count',
      'arrangement',
      'size',
      'color_pattern',
      'border',
      'surface_changes',
      'presence_of_exudate_or_discharge',
      'surrounding_skin_changes',
      'secondary_changes',
      'pattern_or_shape',
      'label',
      'additional_notes',
      'overall_description'
    ];
  
    // Check if any required field is missing or empty
    const missingFields = requiredFields.filter(field => {
      const value = this.jsonData[field];
      return value === undefined || value === null || value.toString().trim() === '';
    });
  
    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }
  
    // Set annotation metadata
    this.jsonData.additionalDiagnosis = this.additionalDiagnosis;
    this.jsonData.additionalObservation = this.additionalObservation;
    this.jsonData.annotatedby = this.username || 'Unknown';
  
    // Get the base filename from the assigned JSON file or annotation data
    let baseFilename = '';
  
    if (this.assignedJsonFile) {
      const parts = this.assignedJsonFile.split('/');
      if (parts.length > 0) {
        baseFilename = parts[parts.length - 1];
      }
    } else if (this.annotationData && this.annotationData.filename) {
      baseFilename = this.annotationData.filename;
    }
  
    if (!baseFilename) {
      console.warn('No valid filename found, using placeholder');
      baseFilename = `annotation_${Date.now()}.json`;
    } else if (!baseFilename.endsWith('.json')) {
      baseFilename = `${baseFilename}.json`;
    }
  
    this.jsonData.originalFilename = baseFilename;

    if (typeof this.jsonData['label'] === 'string') {
      this.jsonData['label'] = this.jsonData['label']
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
    }
    
  
    console.log(`Submitting annotation for file: ${baseFilename} by annotator: ${this.annotatorId}`);
  
  const submitSubscription = this.annotationService.submitAnnotation(this.annotatorId, this.jsonData)
    .subscribe({
      next: (response) => {
        console.log('Annotation submitted successfully', response);
        this.timeTracker.trackSuccessfulSave();
        
        // Clear form
        this.additionalDiagnosis = '';
        this.additionalObservation = '';
        
        this.showSuccessPopup();
        
        // Update progress
        this.getAnnotatorProgress();
        this.sessionAnnotationCount++;
        this.dailyAnnotationCount++;
        
        // Store updated daily count in localStorage
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('lastAnnotationDate', today);
        localStorage.setItem('dailyAnnotationCount', this.dailyAnnotationCount.toString());
        
        // Reset save button state
        this.saveButtonActive = false;
        
        // Load new annotation with safety check
        try {
          if (this.nextAnnotationData) {
            this.loadAnnotationData(this.nextAnnotationData);
            this.nextAnnotationData = null; // Clear after using
          } else {
            // Fallback in case preloaded data isn't available
            this.loadAnnotationData();
          }
        } catch (error) {
          console.error('Error loading next annotation:', error);
          this.saveButtonActive = false;
          this.imageLoaded = true;
          this.descriptionLoaded = true;
          alert('Error loading next annotation. Please refresh the page.');
        }
        
        this.changeDetector.markForCheck();
      },
      error: (err) => {
        console.error('Error submitting annotation:', err);
        alert(`Error submitting annotation: ${err.message || 'Unknown error'}`);
        // Reset UI state
        this.saveButtonActive = false;
        this.imageLoaded = true;
        this.descriptionLoaded = true;
        this.changeDetector.markForCheck();
      }
    });
  
  this.subscriptions.add(submitSubscription);
}

  previousAnnotation(): void {
    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      const previousData = this.historyStack[this.currentHistoryIndex];
      console.log('Loading previous annotation:', previousData);
      this.setAnnotationData(previousData);
    } else {
      alert('No previous annotation available.');
    }
  }

  duplicateText(field: string, value: string) {
    if (field) {
      this.jsonData[field] = value;
      this.changeDetector.markForCheck();
    }
  }

  @HostListener('window:keydown.F5', ['$event'])
handleRefresh(event: KeyboardEvent) {
  event.preventDefault();
  this.recoverFromStuckState();
}

recoverFromStuckState(): void {
  console.log('Attempting to recover from stuck state...');
  // Reset all state variables
  this.saveButtonActive = false;
  this.imageLoading = false;
  this.imageLoaded = true;
  this.descriptionLoaded = true;
  
  // Clean up resources that might be causing the hang
  this.createdBlobUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error revoking URL:', e);
    }
  });
  this.createdBlobUrls = [];
  
  // Force change detection
  this.changeDetector.markForCheck();
  
  // Try to load a fresh annotation
  this.loadAnnotationData();
  
  alert('Recovery attempted. If issues persist, please refresh the browser.');
}

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event) {
    this.timeTracker.stopSessionTracking();
  }
  
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    // Update optimal image width on window resize
    // This could be useful if we're dynamically loading images based on screen size
    if (this.currentImageIndex >= 0 && this.images.length > 0) {
      // Only reload current image if the size change is significant
      const newWidth = this.getOptimalImageWidth();
      if (Math.abs(newWidth - this.imageWidth) > 200) {
        this.imageWidth = newWidth;
        this.loadImageData(this.images[this.currentImageIndex]);
      }
    }
  }

  logout() {
    console.log('Logout button clicked');
    // Force tracking upload on logout
    this.timeTracker.stopSessionTracking(true);
    this.authService.logout();
  }

  markNonRelevant() {
    // Get filename from annotationData
    let fileName = '';
    
    if (this.annotationData && this.annotationData.filename) {
      fileName = this.annotationData.filename;
    } else if (this.assignedJsonFile) {
      // Extract just the filename from path
      const parts = this.assignedJsonFile.split('/');
      if (parts.length > 0) {
        fileName = parts[parts.length - 1];
      }
    }
    
    // Checking if username is same as annotatorId for API consistency
    const username = this.annotatorId; // Use annotatorId instead of username
    
    if (!fileName || !username) {
      console.error('Missing filename or username for marking as non-relevant');
      alert('Unable to mark file as non-relevant: Missing filename or annotator ID');
      return;
    }
    
    console.log(`Marking file as non-relevant: ${fileName} by user: ${username}`);
    
    // Pass both filename and username to the service
    const markSubscription = this.annotationService.markAsNonRelevant(fileName, username).subscribe({
      next: (res) => {
        console.log('File marked as non-relevant:', res);
        this.timeTracker.trackSuccessfulSave();
        
        // Update progress after marking as non-relevant
        this.getAnnotatorProgress();
        this.sessionAnnotationCount++;
        this.dailyAnnotationCount++;
        
        // Store updated daily count in localStorage
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('lastAnnotationDate', today);
        localStorage.setItem('dailyAnnotationCount', this.dailyAnnotationCount.toString());
        
        // Show success popup
        this.showSuccessPopup('Non-relevant annotation saved successfully');
        
        
        // Load new annotation data
        this.loadAnnotationData();
      },
      error: (err) => {
        console.error('Failed to mark as non-relevant', err);
        alert(`Error marking file as non-relevant: ${err.message || 'Unknown error'}`);
      }
    });
    
    this.subscriptions.add(markSubscription);
  }

  showSuccessPopup(message: string = 'Annotation saved successfully') {
    // Create a div element for the popup
    const popup = document.createElement('div');
    popup.className = 'success-popup';
    popup.innerHTML = `<div class="success-message">${message}</div>`;
    document.body.appendChild(popup);
    
    // Remove the popup after 3 seconds
    setTimeout(() => {
      if (popup && document.body.contains(popup)) {
        document.body.removeChild(popup);
      }
    }, 3000);
  }

  @HostListener('input', ['$event.target'])
  autoGrowTextZone(el: EventTarget | null): void {
    if (el instanceof HTMLTextAreaElement) {
      console.log('Resizing:', el.value); // ✅ for debug
      // Reset height first to get the correct scrollHeight
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }

 // In your annotation.component.ts file

 getLabelText(): string {
  if (!this.annotationData) return 'Not specified';

  let label: any = null;

  // 1. Check description.label
  if (this.annotationData.description?.label) {
    label = this.annotationData.description.label;
  }

  // 2. If still not found, check root-level label
  if (!label && this.annotationData.label) {
    label = this.annotationData.label;
  }

  // 3. If still not found, extract from description.caption
  if (!label && this.annotationData.description?.caption) {
    const captionText = this.annotationData.description.caption;
    const labelMatch = captionText.match(/label\s*[:=]\s*([^\n]+)/i);
    if (labelMatch && labelMatch[1]) {
      label = labelMatch[1].trim();
    }
  }

  // Normalize label output
  if (!label) return 'Not specified';
  if (Array.isArray(label)) return label.join(', ');
  return String(label);
}


duplicateLabel(): void {
  if (!this.annotationData) return;

  let label: any = null;

  if (this.annotationData.description?.label) {
    label = this.annotationData.description.label;
  }

  if (!label && this.annotationData.label) {
    label = this.annotationData.label;
  }

  if (!label && this.annotationData.description?.caption) {
    const captionText = this.annotationData.description.caption;
    const labelMatch = captionText.match(/label\s*[:=]\s*([^\n]+)/i);
    if (labelMatch && labelMatch[1]) {
      label = labelMatch[1].trim();
    }
  }

  if (label) {
    this.jsonData['label'] = Array.isArray(label) ? label.join(', ') : String(label);
    this.changeDetector.markForCheck?.(); // Optional
  }
}

fetchFileCounts(): void {
  this.adminBoardService.getFileCounts().subscribe({
    next: (data: FileCountResponse) => {
      this.counts = data;
      this.loading = false;
      console.log('File counts:', this.counts);

      // Update the current annotator's count
      this.updateCurrentAnnotatorCount();

      this.changeDetector.markForCheck(); // Ensure UI updates with OnPush strategy
    },
    error: (err) => {
      this.error = err.message;
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  });
}

updateCurrentAnnotatorCount(): void {
  if (this.counts?.annotatedByCounts && this.username) {
    this.currentAnnotatorCount = this.counts.annotatedByCounts[this.username] || 0;
    console.log(`Current annotator (${this.username}) count: ${this.currentAnnotatorCount}`);
  } else {
    this.currentAnnotatorCount = 0;
  }
  // this.changeDetector.markForChange(); // Explicitly trigger change detection
}

getTotalAnnotations(): number {
  if (!this.counts?.annotatedByCounts) {
    return 0;
  }
  return Object.values(this.counts.annotatedByCounts).reduce((sum, count) => sum + count, 0);
}

ngOnDestroy(): void {
  // Clean up all tracked blob URLs
  this.createdBlobUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error revoking URL:', e);
    }
  });
  this.createdBlobUrls = [];
  
  // Clean up any preloaded images
  this.preloadedImages.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Error revoking preloaded URL:', e);
    }
  });
  this.preloadedImages.clear();
  
  // Cancel all subscriptions to prevent memory leaks
  this.subscriptions.unsubscribe();
  
  // Stop tracking session
  this.timeTracker.stopSessionTracking();
}

}