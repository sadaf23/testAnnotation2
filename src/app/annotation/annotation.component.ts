import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnnotationService } from '../annotation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker-service.service';
import { AuthService } from '../auth.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { AdminBoardService, FileCountResponse } from '../admin-board.service';
import { Description, ImageResponse, AnnotatedData, ImageOptions,AnnotatorCount } from '../interfaces'


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
  isLoading: boolean = false;

  // Image dimensions for layout stability
  imageWidth: number = 800;
  imageHeight: number = 600;

  showDiscussionInput: boolean = false; // New property to toggle discussion textbox
  discussionPoint: string = ''; // New property for discussion point input
  
  counts: FileCountResponse | null = null;
  currentAnnotatorCount: number = 0;

  private fromDiscussion: boolean = false; // Flag to track if loaded from discussion
private navigationState: any = null; // Store router state
searchInput: string = ''; // Input for partial filename
searchResults: { jsonFiles: { name: string, fullPath: string }[], imageFiles: { name: string, fullPath: string }[] } = { jsonFiles: [], imageFiles: [] };
selectedFile: { jsonFile?: string, imageFile?: string } | null = null; 
private formStateKey = 'annotationFormStates';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService, 
    private annotationService: AnnotationService, 
    private http: HttpClient, 
    private timeTracker: TimeTrackerService,
    private changeDetector: ChangeDetectorRef,
    private adminBoardService: AdminBoardService,
    private router: Router
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

    // Capture navigation state
    this.navigationState = history.state;
    this.fromDiscussion = !!this.navigationState?.partialName;

    const routeSubscription = this.route.params.subscribe(params => {
        if (params['id']) {
            this.annotatorId = params['id'];
            localStorage.setItem('annotatorId', this.annotatorId);
        }
        console.log('Using annotator ID:', this.annotatorId);

        if (this.fromDiscussion && this.navigationState?.partialName) {
            // Load files by partial filename
            this.searchInput = this.navigationState.partialName;
            console.log('Searching with partial name:', this.searchInput);
            this.searchFiles();
        } else {
            // Default behavior
            this.loadAllData();
        }
    });

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

  discussionPoints(){
    this.router.navigate(["/discussion-points"]);
  }

  loadAllData(): void {
    this.loading = true;
    this.error = null;
  
    // Save annotator ID to localStorage for persistence
    localStorage.setItem('annotatorId', this.annotatorId);
  
    this.loadDailyAnnotationCount();
  
    if (this.fromDiscussion && this.navigationState?.image_id) {
      // Load specific image by ID
    } else {
      // Default behavior: Load random annotation data
      this.loadAnnotationData();
    }
  }

  searchFiles(): void {
    if (!this.searchInput.trim()) {
        alert('Please enter a partial filename to search.');
        this.error = 'Enter a filename to search for images and descriptions.';
        this.loading = false;
        this.changeDetector.markForCheck();
        return;
    }

    this.loading = true;
    this.error = null;
    this.searchResults = { jsonFiles: [], imageFiles: [] };
    this.selectedFile = null;

    console.log(`Searching files with partial name: ${this.searchInput}`);

    const searchSubscription = this.annotationService.searchFiles(this.searchInput, this.annotatorId).subscribe({
        next: (response) => {
            console.log('Search files response:', JSON.stringify(response, null, 2));
            if (response.success && response.data) {
                this.searchResults = response.data;
                if (this.searchResults.jsonFiles.length === 0 && this.searchResults.imageFiles.length === 0) {
                    this.error = `No files found matching "${this.searchInput}". Please try a different search term.`;
                    console.log(`No matches for ${this.searchInput}. Prompting manual search.`);
                    this.searchInput = '';
                    this.fromDiscussion = false;
                    this.navigationState = null;
                } else if (this.searchResults.jsonFiles.length === 1 && this.searchResults.imageFiles.length === 1) {
                    console.log(`Auto-selecting files: JSON=${this.searchResults.jsonFiles[0].name}, Image=${this.searchResults.imageFiles[0].name}`);
                    this.selectFile(this.searchResults.jsonFiles[0].name, this.searchResults.imageFiles[0].name);
                } else {
                    console.log(`Multiple matches found: ${this.searchResults.jsonFiles.length} JSON, ${this.searchResults.imageFiles.length} images`);
                    this.error = `Multiple files found. Please select one below.`;
                }
            } else {
                this.error = `Failed to search files for "${this.searchInput}". Please try again.`;
                console.log(`Search failed for ${this.searchInput}:`, response);
                this.searchInput = '';
                this.fromDiscussion = false;
                this.navigationState = null;
            }
            this.loading = false;
            this.changeDetector.markForCheck();
        },
        error: (err) => {
            console.error('Error searching files:', err);
            this.error = `Server error while searching for "${this.searchInput}". Please try again or contact support.`;
            this.searchInput = '';
            this.fromDiscussion = false;
            this.navigationState = null;
            this.loading = false;
            this.changeDetector.markForCheck();
        }
    });

    this.subscriptions.add(searchSubscription);
}

selectFile(jsonFile: string, imageFile: string): void {
  console.log(`Selecting files: JSON=${jsonFile}, Image=${imageFile}`);
  this.selectedFile = { jsonFile, imageFile };
  this.assignedJsonFile = jsonFile;
  this.assignedImageFile = imageFile;
  this.loading = true;
  
  // Extract the base filename from the path
  const baseFilename = jsonFile.split('/').pop();
  if (!baseFilename) {
    console.error('Invalid filename format');
    this.loading = false;
    return;
  }

  // Load JSON data
  console.log(`Loading JSON data for ${jsonFile}`);
  const jsonSubscription = this.annotationService.getJsonData(baseFilename, this.annotatorId || undefined).subscribe({
    next: (data) => {
      console.log('JSON data loaded:', data);
      this.jsonData = data;
      
      // Create key-value pairs for display
      this.jsonKeyValues = Object.entries(this.jsonData).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      }));
      
      // Also update the annotationData object that the template uses
      this.annotationData = {
        description: this.jsonData,
        filename: baseFilename,
        images: [imageFile]
      };
      
      // Mark description as loaded
      this.descriptionLoaded = true;
      this.checkLoadingComplete();
      this.changeDetector.markForCheck();
    },
    error: (error) => {
      console.error('Error loading JSON data:', error);
      this.loading = false;
      this.error = 'Failed to load JSON data. Please try again.';
      this.changeDetector.markForCheck();
    }
  });
  
  this.subscriptions.add(jsonSubscription);

  // Load image data
  console.log(`Loading image data for ${imageFile}`);
  this.images = [imageFile];
  this.currentImageIndex = 0;
  this.loadImageData(imageFile);

  // Reset search state
  this.searchResults = { jsonFiles: [], imageFiles: [] };
  this.searchInput = '';
  this.fromDiscussion = false;
  this.navigationState = null;
  this.changeDetector.markForCheck();
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
    // Save current form state before loading new data
    if (this.annotationData?.filename) {
      this.saveCurrentFormState();
    }
  
    this.annotationData = data;
    this.textareasResized = false;
  
    if (this.currentHistoryIndex === -1 || this.historyStack[this.currentHistoryIndex]?.filename !== data.filename) {
      this.historyStack.push(data);
      this.currentHistoryIndex = this.historyStack.length - 1;
    }
  
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
  
    // Restore form state for this annotation if it exists
    this.restoreFormState();
  }
  

  private saveCurrentFormState(): void {
    if (!this.annotationData?.filename) {
      return;
    }
  
    const currentState = {
      jsonData: { ...this.jsonData },
      additionalDiagnosis: this.additionalDiagnosis || '',
      additionalObservation: this.additionalObservation || '',
      discussionPoint: this.discussionPoint || '',
      showDiscussionInput: this.showDiscussionInput || false,
      timestamp: Date.now()
    };
  
    try {
      const existingStates = this.getStoredFormStates();
      existingStates[this.annotationData.filename] = currentState;
      
      // Clean up old states (keep only last 10 to prevent localStorage bloat)
      this.cleanupOldFormStates(existingStates);
      
      localStorage.setItem(this.formStateKey, JSON.stringify(existingStates));
      console.log(`Form state saved for: ${this.annotationData.filename}`, {
        additionalDiagnosis: currentState.additionalDiagnosis,
        additionalObservation: currentState.additionalObservation
      });
    } catch (error) {
      console.warn('Failed to save form state to localStorage:', error);
    }
  }
  
  // Method to restore form state from localStorage
  private restoreFormState(): void {
    if (!this.annotationData?.filename) {
      return;
    }
  
    try {
      const existingStates = this.getStoredFormStates();
      const savedState = existingStates[this.annotationData.filename];
      
      if (savedState) {
        // Restore form data
        this.jsonData = { ...this.jsonData, ...savedState.jsonData };
        this.additionalDiagnosis = savedState.additionalDiagnosis || '';
        this.additionalObservation = savedState.additionalObservation || '';
        this.discussionPoint = savedState.discussionPoint || '';
        this.showDiscussionInput = savedState.showDiscussionInput || false;
  
        // Update jsonKeyValues to reflect restored data
        if (this.jsonData) {
          this.jsonKeyValues = Object.entries(this.jsonData).map(
            ([key, value]) => ({ key, value: String(value) })
          );
        }
  
        console.log(`Form state restored for: ${this.annotationData.filename}`, {
          additionalDiagnosis: this.additionalDiagnosis,
          additionalObservation: this.additionalObservation,
          hasJsonData: !!this.jsonData
        });
        
        // Force change detection to update the UI
        this.changeDetector.detectChanges();
      } else {
        console.log(`No saved form state found for: ${this.annotationData.filename}`);
      }
    } catch (error) {
      console.warn('Failed to restore form state from localStorage:', error);
    }
  }
  
  // Helper method to get stored form states
  private getStoredFormStates(): { [filename: string]: any } {
    try {
      const stored = localStorage.getItem(this.formStateKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to parse stored form states:', error);
      return {};
    }
  }
  
  // Helper method to clean up old form states
  private cleanupOldFormStates(states: { [filename: string]: any }): void {
    const maxStates = 10;
    const entries = Object.entries(states);
    
    if (entries.length > maxStates) {
      // Sort by timestamp and keep only the most recent ones
      const sortedEntries = entries.sort((a, b) => 
        (b[1].timestamp || 0) - (a[1].timestamp || 0)
      );
      
      const keepEntries = sortedEntries.slice(0, maxStates);
      
      // Clear the states object and repopulate with kept entries
      Object.keys(states).forEach(key => delete states[key]);
      keepEntries.forEach(([filename, state]) => {
        states[filename] = state;
      });
    }
  }
  
  // Method to clear form state for current annotation
  private clearCurrentFormState(): void {
    if (!this.annotationData?.filename) {
      return;
    }
  
    try {
      const existingStates = this.getStoredFormStates();
      delete existingStates[this.annotationData.filename];
      localStorage.setItem(this.formStateKey, JSON.stringify(existingStates));
      console.log(`Form state cleared for: ${this.annotationData.filename}`);
    } catch (error) {
      console.warn('Failed to clear form state:', error);
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
    this.imageLoading = true;
    
    const preloadedUrl = this.preloadedImages.get(imageName);
    
    if (preloadedUrl) {
        console.log(`Using preloaded image for ${imageName}`);
        this.imageUrl = preloadedUrl;
        this.preloadedImages.delete(imageName);
        
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
                if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(this.imageUrl);
                }
                
                this.imageUrl = URL.createObjectURL(blob);
                
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

  toggleDiscussionInput(): void {
    this.showDiscussionInput = !this.showDiscussionInput;
    this.discussionPoint = ''; // Reset discussion point when toggling
    this.changeDetector.markForCheck();
  }

  saveForDiscussion(): void {
    if (!this.discussionPoint.trim()) {
      alert('Please enter a discussion point.');
      return;
    }
  
    // Get the original assigned filename
    let baseFilename = this.assignedJsonFile || `discussion_${Date.now()}.json`;
    
    // Extract just the actual filename from the path
    if (baseFilename.includes('/')) {
      // Split by / and get the last part (the filename)
      baseFilename = baseFilename.split('/').pop() || baseFilename;
    }
    if (baseFilename.includes('_')) {
    }
  
    console.log('Extracted baseFilename:', baseFilename);
    
    // Extract the image ID from the baseFilename (now it's the actual filename)
    const imageId = baseFilename.split('.').slice(0, -1).join('.');
    console.log('Extracted imageId:', imageId);
  
    const discussionData = {
      imageUrl: this.imageUrl,
      description: { ...this.jsonData, image_id: imageId },
      discussionPoint: this.discussionPoint,
      username: this.username,
      date: new Date().toISOString(),
      annotatorId: this.annotatorId,
      fileName: baseFilename
    };
  
    console.log('Final discussionData:', discussionData);
  
    // Show loading indicator
    this.isLoading = true;
    this.imageLoaded = false;
    this.descriptionLoaded = false;
    this.changeDetector.markForCheck();
    
    // Call the service method to save the discussion point
    this.annotationService.saveDiscussionPoint(discussionData)
      .subscribe({
        next: (response) => {
          // Handle success
          this.isLoading = false;
          // this.timeTracker.trackSuccessfulSave();
          alert('Discussion point saved successfully!');
          
          // Toggle off the discussion input
          this.showDiscussionInput = false;
          
          // Reset form
          this.resetForm();
          
          // Load next annotation data
          if (this.nextAnnotationData) {
            this.loadAnnotationData(this.nextAnnotationData);
            this.nextAnnotationData = null; // Clear after using
          } else {
            // Fallback in case preloaded data isn't available
            this.loadAnnotationData();
          }
        },
        error: (error) => {
          // Handle error
          this.isLoading = false;
          console.error('Error saving discussion:', error);
          alert('Error saving discussion point. Please try again.');
          this.changeDetector.markForCheck();
        }
      });
  }

  // Helper method to reset the form after successful submission
  resetForm(): void {
    this.discussionPoint = '';
    // Reset other form fields as needed
  }


  
  saveAndNext() {
    // Set button to active state
    this.saveButtonActive = true;
    this.imageLoaded = false;
    this.descriptionLoaded = false;
    this.changeDetector.markForCheck();
    
    // Call the existing submit method
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

        // Clear the saved form state since annotation is submitted
        this.clearCurrentFormState();

        // Clear form
        this.additionalDiagnosis = '';
        this.additionalObservation = '';

        alert("Annotation submitted successfully!");

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
      // Save current state before navigating
      this.saveCurrentFormState();
      
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
  // Only stop tracking if closing the browser tab/window
  if (!this.router.navigated) {
    this.timeTracker.stopSessionTracking();
  }
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
    this.timeTracker.stopSessionTracking(true);
    this.authService.logout();
    this.router.navigate(['/login']);
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
        
        // Clear the saved form state since annotation is completed
        this.clearCurrentFormState();
        
        // Clear the saved form state since annotation is completed
        this.clearCurrentFormState();
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
        alert('Non-relevant annotation saved successfully');
        
        
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


  @HostListener('input', ['$event.target'])
  autoGrowTextZone(el: EventTarget | null): void {
    if (el instanceof HTMLTextAreaElement) {
      // Reset height first to get the correct scrollHeight
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }

  @HostListener('input', ['$event'])
onFormInput(event: Event): void {
  // Auto-grow textarea functionality
  if (event.target instanceof HTMLTextAreaElement) {
    event.target.style.height = 'auto';
    event.target.style.height = event.target.scrollHeight + 'px';
  }
  
  // Save form state on input changes (debounced)
  this.debounceFormStateSave();
}

@HostListener('change', ['$event'])
onFormChange(event: Event): void {
  // Save form state on select/checkbox changes (debounced)
  this.debounceFormStateSave();
}

private saveFormStateTimeout: any;

private debounceFormStateSave(): void {
  if (this.saveFormStateTimeout) {
    clearTimeout(this.saveFormStateTimeout);
  }
  
  this.saveFormStateTimeout = setTimeout(() => {
    this.saveCurrentFormState();
  }, 1000); // Save after 1 second of no input
}

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
    // Clean up any object URLs to prevent memory leaks
    this.saveCurrentFormState();
  
    // Clear the timeout
    if (this.saveFormStateTimeout) {
      clearTimeout(this.saveFormStateTimeout);
    }

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
    // this.timeTracker.stopSessionTracking();
  }
}