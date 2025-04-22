import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnnotationService } from '../annotation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker-service.service';
import { AuthService } from '../auth.service';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';

interface AnnotatedData {
  [key: string]: any;
}

interface ImageOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  quality?: number;
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
  
  // Image dimensions for layout stability
  imageWidth: number = 800;
  imageHeight: number = 600;
  


  constructor(
    private route: ActivatedRoute,
    private authService: AuthService, 
    private annotationService: AnnotationService, 
    private http: HttpClient, 
    private timeTracker: TimeTrackerService,
    private changeDetector: ChangeDetectorRef
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
    
    this.subscriptions.add(routeSubscription);
    this.loadDailyAnnotationCount();
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
    // Check if this image was preloaded
    const preloadedUrl = this.preloadedImages.get(imageName);
    
    if (preloadedUrl) {
      console.log(`Using preloaded image for ${imageName}`);
      this.imageUrl = preloadedUrl;
      // Remove from the preloaded map to free memory
      this.preloadedImages.delete(imageName);
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
          
          this.imageUrl = URL.createObjectURL(blob);
          this.changeDetector.markForCheck();
        },
        error: (err) => {
          console.error('Error loading image:', err);
          this.error = 'Failed to load image. Please try again.';
          this.changeDetector.markForCheck();
        }
      });
      
      this.subscriptions.add(imageSubscription);
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
    this.submitAnnotation(this.jsonData);

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
  
          // Load new annotation
          if (this.nextAnnotationData) {
            this.loadAnnotationData(this.nextAnnotationData);
            this.nextAnnotationData = null; // Clear after using
          } else {
            // Fallback in case preloaded data isn't available
            this.loadAnnotationData();
          }
          
          this.changeDetector.markForCheck();
        },
        error: (err) => {
          console.error('Error submitting annotation:', err);
          alert(`Error submitting annotation: ${err.message || 'Unknown error'}`);
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


  ngOnDestroy(): void {
    // Clean up any object URLs to prevent memory leaks
    this.preloadedImages.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.preloadedImages.clear();
    
    if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imageUrl);
    }
    
    // Cancel all subscriptions to prevent memory leaks
    this.subscriptions.unsubscribe();
    
    // Stop tracking session
    this.timeTracker.stopSessionTracking();
  }
}