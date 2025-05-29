import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ImageAnnotationService } from '../image-annotation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { AnnotationData, AnnotationResponse, AnnotationStats } from '../interfaces';

@Component({
  selector: 'app-image-annotation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-annotation.component.html',
  styleUrls: ['./image-annotation.component.css']
})
export class ImageAnnotationComponent implements OnInit, OnDestroy {
  patientId: string = '';
  images: { name: string; url: string }[] = [];
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  currentImageIndex: number = 0;
  legible: boolean = false;
  nonLegible: boolean = false;
  username: string = '';
  checklistItems: { id: string; selected: boolean }[] = [
    { id: 'blurry', selected: false },
    { id: 'dark', selected: false },
    { id: 'obstructed', selected: false },
    { id: 'quality', selected: false },
    { id: 'incomplete', selected: false },
    { id: 'other', selected: false }
  ];
  allPatients: { patientId: string; images: { name: string; url: string }[] }[] = [];
  currentPatientIndex: number = 0;
  private subscription: Subscription = new Subscription();
  private saveAnnotationSubject = new Subject<AnnotationData>();
  isCompleted: boolean = false;
  annotationStats: AnnotationStats | null = null;
  showStats: boolean = false;
  isZoomed = false;
  // Track the "current" image being annotated
  private currentImageBookmark: { patientIndex: number; imageIndex: number } | null = null;

  constructor(
    private patientImageService: ImageAnnotationService,
    private cdr: ChangeDetectorRef
  ) {
    this.saveAnnotationSubject.pipe(
      debounceTime(1000),
      switchMap(annotationData => this.patientImageService.saveAnnotation(annotationData))
    ).subscribe({
      next: (response: AnnotationResponse) => {
        this.isSaving = false;
        if (response.success) {
          this.successMessage = 'Annotation saved successfully!';
          console.log('[ImageAnnotationComponent] Annotation saved:', response);
          this.patientImageService.clearImageCache();
          this.patientImageService.clearStatsCache();
          // Update bookmark after successful save
          this.updateCurrentImageBookmark();
          this.advanceToNext();
          this.loadAnnotationStats();
        } else {
          this.errorMessage = response.message || 'Failed to save annotation';
          console.error('[ImageAnnotationComponent] Save response error:', response.message);
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error.message || 'Failed to save annotation';
        console.error('[ImageAnnotationComponent] Error saving annotation:', error);
        if (error.message.includes('Duplicate annotation')) {
          this.errorMessage = 'This image was already annotated. Moving to next image.';
          this.updateCurrentImageBookmark();
          this.advanceToNext();
        }
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.username = this.patientImageService.getCurrentUsername();
    this.fetchImages();
    this.loadAnnotationStats();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private fetchImages(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.isCompleted = false;
    console.log('[ImageAnnotationComponent] Fetching images');
    this.subscription.add(
      this.patientImageService.getAllPatientImages().subscribe({
        next: (patients) => {
          this.isLoading = false;
          this.allPatients = patients;
          console.log('[ImageAnnotationComponent] Fetched patients:', patients.length);
          if (patients.length === 0) {
            console.log('[ImageAnnotationComponent] No patients available, retrying in 5s');
            setTimeout(() => this.fetchImages(), 5000);
            return;
          }
          this.loadPatient(0);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Failed to fetch images';
          console.error('[ImageAnnotationComponent] Error fetching images:', error);
          setTimeout(() => this.fetchImages(), 5000);
          this.cdr.markForCheck();
        }
      })
    );
  }

  private loadAnnotationStats(): void {
    this.subscription.add(
      this.patientImageService.getAnnotationStats().subscribe({
        next: (response) => {
          if (response.success) {
            this.annotationStats = response.stats;
            console.log('[ImageAnnotationComponent] Loaded stats:', this.annotationStats);
          }
        },
        error: (error) => {
          console.error('[ImageAnnotationComponent] Error loading stats:', error);
        }
      })
    );
  }

  toggleZoom(): void {
    this.isZoomed = !this.isZoomed;
    this.cdr.detectChanges();
  }

  private loadPatient(patientIndex: number): void {
    if (patientIndex >= this.allPatients.length) {
      console.log('[ImageAnnotationComponent] No more patients in batch, fetching more');
      this.fetchImages();
      return;
    }
    this.currentPatientIndex = patientIndex;
    this.patientId = this.allPatients[patientIndex].patientId;
    this.images = this.allPatients[patientIndex].images;
    this.currentImageIndex = 0;
    this.resetImageState();
    // Set or update bookmark for new patient
    this.updateCurrentImageBookmark();
    this.isLoading = false;
    console.log(`[ImageAnnotationComponent] Loaded patient ${this.patientId} with ${this.images.length} images`);
    this.cdr.markForCheck();
  }

  getCurrentImage(): { name: string; url: string } | null {
    return this.images.length > 0 ? this.images[this.currentImageIndex] : null;
  }

  isLastImage(): boolean {
    return this.currentImageIndex === this.images.length - 1;
  }

  isFirstImageOfFirstPatient(): boolean {
    return this.currentPatientIndex === 0 && this.currentImageIndex === 0;
  }

  isLastImageOfLastPatient(): boolean {
    return this.currentPatientIndex === this.allPatients.length - 1 && this.currentImageIndex === this.images.length - 1;
  }

  Onlegible(): void {
    this.legible = true;
    this.nonLegible = false;
    this.resetChecklist();
    console.log(`[ImageAnnotationComponent] Image ${this.getCurrentImage()?.name} marked as legible`);
    this.updateCurrentImageBookmark(); // Update bookmark when annotation starts
    this.cdr.markForCheck();
    setTimeout(() => this.saveCurrentAnnotation(), 500);
  }

  OnnonLegible(): void {
    this.nonLegible = true;
    this.legible = false;
    console.log(`[ImageAnnotationComponent] Image ${this.getCurrentImage()?.name} marked as non-legible`);
    this.updateCurrentImageBookmark(); // Update bookmark when annotation starts
    this.cdr.markForCheck();
  }

  onChecklistChange(itemId: string): void {
    const item = this.checklistItems.find(i => i.id === itemId);
    if (item) {
      item.selected = !item.selected;
      console.log(`[ImageAnnotationComponent] Checklist item ${itemId} set to ${item.selected}`);
      this.cdr.markForCheck();
    }
  }

  isAnyChecklistItemSelected(): boolean {
    return this.checklistItems.some(item => item.selected);
  }

  private resetChecklist(): void {
    this.checklistItems.forEach(item => (item.selected = false));
    console.log('[ImageAnnotationComponent] Checklist reset');
    this.cdr.markForCheck();
  }

  private resetImageState(): void {
    this.resetChecklist();
    this.legible = false;
    this.nonLegible = false;
    this.clearMessages();
    console.log('[ImageAnnotationComponent] Image state reset');
    this.cdr.markForCheck();
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  goToPreviousImage(): void {
    console.log('[ImageAnnotationComponent] Previous button clicked - currentImageIndex:', this.currentImageIndex);
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.resetImageState();
      console.log(`[ImageAnnotationComponent] Moved to previous image: ${this.currentImageIndex}`);
      this.cdr.markForCheck();
    } else if (this.currentPatientIndex > 0) {
      const previousPatientIndex = this.currentPatientIndex - 1;
      const previousPatient = this.allPatients[previousPatientIndex];
      this.currentPatientIndex = previousPatientIndex;
      this.patientId = previousPatient.patientId;
      this.images = previousPatient.images;
      this.currentImageIndex = this.images.length - 1;
      this.resetImageState();
      console.log(`[ImageAnnotationComponent] Moved to patient ${this.patientId}, image ${this.currentImageIndex}`);
      this.cdr.markForCheck();
    }
  }

  skipToNextImage(): void {
    console.log('[ImageAnnotationComponent] Skip button clicked');
    if (!this.isOnCurrentImage()) {
      this.goToCurrentImage();
    } else {
      this.advanceToNext();
    }
  }

  saveNonLegibleAndContinue(): void {
    console.log('[ImageAnnotationComponent] Save non-legible button clicked');
    if (this.isAnyChecklistItemSelected()) {
      this.saveCurrentAnnotation();
    } else {
      this.errorMessage = 'Please select at least one reason for non-legibility.';
      this.cdr.markForCheck();
    }
  }

  private saveCurrentAnnotation(): void {
    const currentImage = this.getCurrentImage();
    if (!currentImage) {
      this.errorMessage = 'No image to save annotation for';
      console.log('[ImageAnnotationComponent] No image to annotate');
      return;
    }
    if (!/^\d{17}$/.test(this.patientId)) {
      this.errorMessage = 'Invalid Patient ID format';
      console.error('[ImageAnnotationComponent] Invalid Patient ID:', this.patientId);
      return;
    }
    this.isSaving = true;
    this.clearMessages();

    const checklistItemsObj = this.checklistItems.reduce((acc, item) => ({
      ...acc,
      [item.id]: item.selected
    }), {} as { [key: string]: boolean });

    const annotationData: AnnotationData = {
      patientId: this.patientId,
      fileName: currentImage.name,
      legible: this.legible,
      nonLegible: this.nonLegible,
      checklistItems: checklistItemsObj,
      username: this.username
    };

    console.log('[ImageAnnotationComponent] Saving annotation:', annotationData);
    this.saveAnnotationSubject.next(annotationData);
  }

  saveCurrentAnnotationManually(): void {
    this.saveCurrentAnnotation();
  }

  toggleStats(): void {
    this.showStats = !this.showStats;
    if (this.showStats && !this.annotationStats) {
      this.loadAnnotationStats();
    }
  }

  get totalPatients(): string {
    return this.allPatients.length.toString();
  }

  get currentPatientNumber(): string {
    return (this.currentPatientIndex + 1).toString();
  }

  private advanceToNext(): void {
    console.log('[ImageAnnotationComponent] Advancing:', {
      currentImageIndex: this.currentImageIndex,
      totalImages: this.images.length,
      currentPatientIndex: this.currentPatientIndex,
      totalPatients: this.allPatients.length
    });
    if (this.currentImageIndex < this.images.length - 1) {
      this.currentImageIndex++;
      this.resetImageState();
      this.updateCurrentImageBookmark(); // Update bookmark for new image
      console.log(`[ImageAnnotationComponent] Moved to image ${this.currentImageIndex + 1} of ${this.images.length} for patient ${this.patientId}`);
      this.cdr.markForCheck();
    } else {
      console.log('[ImageAnnotationComponent] Moving to next patient');
      this.loadPatient(this.currentPatientIndex + 1);
    }
  }

  saveBatchAnnotations(annotationsToSave: Omit<AnnotationData, 'username'>[]): void {
    if (annotationsToSave.length === 0) {
      this.errorMessage = 'No annotations to save';
      return;
    }
    this.isSaving = true;
    this.clearMessages();
    this.subscription.add(
      this.patientImageService.saveAnnotationsBatch(annotationsToSave, this.username).subscribe({
        next: (response) => {
          this.isSaving = false;
          if (response.success) {
            this.successMessage = `${annotationsToSave.length} annotations saved successfully!`;
            this.patientImageService.clearImageCache();
            this.patientImageService.clearStatsCache();
            this.fetchImages();
            this.loadAnnotationStats();
          } else {
            this.errorMessage = response.message || 'Failed to save batch annotations';
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage = error.message || 'Failed to save batch annotations';
          console.error('[ImageAnnotationComponent] Error saving batch annotations:', error);
          this.cdr.markForCheck();
        }
      })
    );
  }

  isCurrentAnnotationValid(): boolean {
    if (!this.legible && !this.nonLegible) {
      return false;
    }
    if (this.nonLegible && !this.isAnyChecklistItemSelected()) {
      return false;
    }
    return true;
  }

  getProgressInfo(): { current: number; total: number; percentage: number } {
    let totalImages = 0;
    let currentPosition = 0;
    this.allPatients.forEach((patient, patientIndex) => {
      if (patientIndex < this.currentPatientIndex) {
        currentPosition += patient.images.length;
      } else if (patientIndex === this.currentPatientIndex) {
        currentPosition += this.currentImageIndex;
      }
      totalImages += patient.images.length;
    });
    currentPosition += 1;
    const percentage = totalImages > 0 ? Math.round((currentPosition / totalImages) * 100) : 0;
    return { current: currentPosition, total: totalImages, percentage };
  }

  onKeyDown(event: KeyboardEvent): void {
    if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
      event.preventDefault();
    }
    switch (event.code) {
      case 'ArrowLeft':
        this.goToPreviousImage();
        break;
      case 'ArrowRight':
        if (this.isCurrentAnnotationValid() || !this.isOnCurrentImage()) {
          this.skipToNextImage();
        }
        break;
      case 'KeyL':
        this.Onlegible();
        break;
      case 'KeyN':
        this.OnnonLegible();
        break;
      case 'Enter':
        if (this.nonLegible && this.isAnyChecklistItemSelected()) {
          this.saveNonLegibleAndContinue();
        }
        break;
    }
  }

  exportAnnotationData(): void {
    this.subscription.add(
      this.patientImageService.getAnnotationStats().subscribe({
        next: (response) => {
          if (response.success && response.stats) {
            const dataStr = JSON.stringify(response.stats, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = `annotation_stats_${new Date().toISOString().split('T')[0]}.json`;
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            this.successMessage = 'Annotation statistics exported successfully!';
            setTimeout(() => this.clearMessages(), 3000);
          }
        },
        error: (error) => {
          this.errorMessage = 'Failed to export annotation data';
          console.error('[ImageAnnotationComponent] Export error:', error);
          this.cdr.markForCheck();
        }
      })
    );
  }

  // New methods for current image navigation
  private updateCurrentImageBookmark(): void {
    this.currentImageBookmark = {
      patientIndex: this.currentPatientIndex,
      imageIndex: this.currentImageIndex
    };
    console.log('[ImageAnnotationComponent] Updated bookmark:', this.currentImageBookmark);
  }

  goToCurrentImage(): void {
    if (this.currentImageBookmark) {
      console.log('[ImageAnnotationComponent] Returning to current image:', this.currentImageBookmark);
      this.currentPatientIndex = this.currentImageBookmark.patientIndex;
      this.patientId = this.allPatients[this.currentPatientIndex].patientId;
      this.images = this.allPatients[this.currentPatientIndex].images;
      this.currentImageIndex = this.currentImageBookmark.imageIndex;
      this.resetImageState();
      this.cdr.markForCheck();
    }
  }

  isOnCurrentImage(): boolean {
    if (!this.currentImageBookmark) {
      return true; // No bookmark means we're on the first image
    }
    return (
      this.currentPatientIndex === this.currentImageBookmark.patientIndex &&
      this.currentImageIndex === this.currentImageBookmark.imageIndex
    );
  }
}