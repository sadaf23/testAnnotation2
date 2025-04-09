import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnnotationService } from '../annotation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker-service.service';
import { AuthService } from '../auth.service';
import { ActivatedRoute } from '@angular/router';

interface AnnotatedData {
  [key: string]: any;
}

@Component({
  selector: 'app-annotation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './annotation.component.html',
  styleUrls: ['./annotation.component.css']
})
export class AnnotationComponent implements OnInit {
  
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
  severity: string = '';
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

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService, 
    private annotationService: AnnotationService, 
    private http: HttpClient, 
    private timeTracker: TimeTrackerService
  ) {}

  ngOnInit() {
    console.log('Fetching Annotator ID from localStorage...');
    this.annotatorId = localStorage.getItem('annotatorId') || 'general';
    console.log('Fetched Annotator ID:', this.annotatorId);
    this.username = localStorage.getItem('username') || 'Guest';
    
    this.timeTracker.startSessionTracking();
    
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.annotatorId = params['id'];
        localStorage.setItem('annotatorId', this.annotatorId);
      }
      console.log('Using annotator ID:', this.annotatorId);
      this.loadAllData();
    });
  }

  toggleZoom(): void {
    this.isZoomed = !this.isZoomed;
  }

  loadAllData(): void {
    this.loading = true;
    this.error = null;
    
    // Save annotator ID to localStorage for persistence
    localStorage.setItem('annotatorId', this.annotatorId);
    
    // Load annotation data
    this.loadAnnotationData();
    
    // Load progress data in parallel
    this.getAnnotatorProgress();
  }
  
  loadAnnotationData(): void {
    this.loading = true;
    this.error = null;
  
    this.annotationService.getAnnotationData(this.annotatorId)
      .subscribe({
        next: (data) => {
          this.annotationData = data;
          console.log('Annotation data loaded:', data);
  
          // Process description
          if (this.annotationData && this.annotationData.description) {
            this.jsonKeyValues = Object.entries(this.annotationData.description).map(
              ([key, value]) => ({ key, value: String(value) })
            );            
            this.jsonData = { ...this.annotationData.description };
          }
  
          // Handle random data if available
          if (this.annotationData.randomData) {
            this.randomData = this.annotationData.randomData;
            
            if (this.randomData.jsonFiles && this.randomData.jsonFiles.length > 0) {
              this.assignedJsonFile = this.randomData.jsonFiles[0];
            }
            
            if (this.randomData.imageFiles && this.randomData.imageFiles.length > 0) {
              this.assignedImageFile = this.randomData.imageFiles[0];
            }
          }
  
          // Process image paths if available
          if (this.annotationData && this.annotationData.images) {
            this.images = this.annotationData.images;
            if (this.images.length > 0) {
              this.loadImageData(this.images[0]);
            }
          }
  
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading annotation data:', err);
          this.error = 'Failed to load annotation data. Please try again.';
          this.loading = false;
        }
      });
  }

  loadImageData(imageName: string): void {
    this.annotationService.getImageUrl(this.annotatorId, imageName)
      .subscribe({
        next: (blob) => {
          this.imageUrl = URL.createObjectURL(blob);
        },
        error: (err) => {
          console.error('Error loading image:', err);
          this.error = 'Failed to load image. Please try again.';
        }
      });
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

    this.annotationService.getAnnotatorProgress(this.annotatorId).subscribe({
      next: (progress) => {
        console.log('Annotator progress:', progress);
        this.progress = progress;
      },
      error: (error) => {
        console.error('Error fetching annotator progress:', error);
        // Don't set main error to avoid blocking the UI
      }
    });
  }

  loadJsonData(filename: string) {
    const baseFilename = filename.split('/').pop();
    if (!baseFilename) {
      console.error('Invalid filename format');
      return;
    }

    this.annotationService.getJsonData(baseFilename, this.annotatorId || undefined).subscribe({
      next: (data) => {
        console.log('JSON data loaded:', data);
        this.jsonData = data;
        
        // Create key-value pairs for display
        this.jsonKeyValues = Object.entries(this.jsonData).map(([key, value]) => ({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value)
        }));
      },
      error: (error) => {
        console.error('Error loading JSON data:', error);
      }
    });
  }

  loadImageUrl(filename: string) {
    const baseFilename = filename.split('/').pop();
    if (!baseFilename) {
      console.error('Invalid filename format');
      return;
    }
    
    this.annotationService.getImageUrl(this.annotatorId, baseFilename).subscribe({
      next: (blob) => {
        const imageUrl = URL.createObjectURL(blob);
        this.imageUrl = imageUrl;
      },
      error: (err) => {
        console.error('Error loading image:', err);
      }
    });
  }

  saveAnnotation() {
    if (!this.jsonData || !this.assignedJsonFile || !this.annotatorId) {
      console.error('Missing data for saving annotation');
      return;
    }
  
    this.jsonData.severity = this.severity;
    this.jsonData.additionalDiagnosis = this.additionalDiagnosis;
    this.jsonData.annotatedby = this.username; // Store the annotator's username
  
    const baseFilename = this.assignedJsonFile.split('/').pop() || '';
    const annotatedFilename = baseFilename;
  
    console.log(`Saving annotation as: ${annotatedFilename} by annotator: ${this.username}`);
  
    this.annotationService.uploadJson(this.jsonData, annotatedFilename, this.annotatorId)
      .subscribe({
        next: (response) => {
          console.log('Annotation saved successfully:', response);
          
          // Track successful save only after confirmed success
          this.timeTracker.trackSuccessfulSave();
  
          this.severity = '';
          this.additionalDiagnosis = '';
  
          // Fetch updated progress only after a successful save
          this.getAnnotatorProgress();
          
          // Load new annotation data
          this.loadAnnotationData();
        },
        error: (error) => {
          console.error('Error saving annotation:', error);
          // No tracking increment on error
        }
      });
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
      'additional_notes',
      'overall_description'
    ];
    
    if (!this.additionalDiagnosis || this.additionalDiagnosis.trim() === '') {
      alert('Please enter a Differential Diagnosis.');
      return;
    }
  
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
  
    console.log(`Submitting annotation for file: ${baseFilename} by annotator: ${this.annotatorId}`);
  
    console.log('Annotation data being sent:', JSON.stringify({
      annotatorId: this.annotatorId,
      annotationData: this.jsonData
    }, null, 2));
  
    this.annotationService.submitAnnotation(this.annotatorId, this.jsonData)
      .subscribe({
        next: (response) => {
          console.log('Annotation submitted successfully', response);
          this.timeTracker.trackSuccessfulSave();
  
          // Clear form
          this.severity = '';
          this.additionalDiagnosis = '';
  
          // Update progress
          this.getAnnotatorProgress();
  
          // Load new annotation
          this.loadAnnotationData();
        },
        error: (err) => {
          console.error('Error submitting annotation:', err);
          alert(`Error submitting annotation: ${err.message || 'Unknown error'}`);
        }
      });
  }
  

  duplicateText(field: string, value: string) {
    if (field) {
      this.jsonData[field] = value;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event) {
    this.timeTracker.stopSessionTracking();
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
    
    this.annotationService.markAsNonRelevant(fileName, username).subscribe({
      next: (res) => {
        console.log('File marked as non-relevant:', res);
        
        // Update progress after marking as non-relevant
        this.getAnnotatorProgress();
        
        // Load new annotation data
        this.loadAnnotationData();
      },
      error: (err) => {
        console.error('Failed to mark as non-relevant', err);
        alert(`Error marking file as non-relevant: ${err.message || 'Unknown error'}`);
      }
    });
  }
}