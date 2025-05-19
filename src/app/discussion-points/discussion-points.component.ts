import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AnnotationService } from '../annotation.service';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { TimeTrackerService } from '../time-tracker-service.service';
import { DiscussionPoint, ApiResponse } from '../interfaces'

@Component({
  selector: 'app-discussion-points',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './discussion-points.component.html',
  styleUrls: ['./discussion-points.component.css']
})
export class DiscussionPointsComponent implements OnInit, OnDestroy {
  discussionPoints: DiscussionPoint[] = [];
  isAdmin: boolean = false;
  username: string = '';
  loading: boolean = true;
  error: string | null = null;
  private subscriptions = new Subscription();

  constructor(
    private annotationService: AnnotationService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private timeTracker: TimeTrackerService
  ) {}

  ngOnInit() {
    this.username = localStorage.getItem('username') || 'Guest';
    this.isAdmin = this.authService.isAdmin();
    this.loadDiscussionPoints();
  }

  loadDiscussionPoints() {
    this.loading = true;
    this.error = null;

    const discussionSubscription = this.annotationService.getDiscussionPoints()
      .subscribe({
        next: (response: ApiResponse) => {
          console.log('Discussion points response:', response);
          this.discussionPoints = response.data || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading discussion points:', err);
          this.error = 'Failed to load discussion points. Please try again.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });

    this.subscriptions.add(discussionSubscription);
  }

  viewAnnotation(point: DiscussionPoint) {
    console.log('Discussion point:', JSON.stringify(point, null, 2));

    // Try to extract partial filename from image_id, fileName, or imageUrl
    let partialName = '';

    if (point.description?.image_id) {
        partialName = point.description.image_id.toString();
        console.log(`Trying partial name from image_id: ${partialName}`);
    }

    if (!partialName && point.fileName) {
        const baseName = point.fileName.split('.').slice(0, -1).join('.');
        const parts = baseName.split('_');
        partialName = parts[0]; // e.g., "image_1"
        console.log(`Trying partial name from fileName base: ${partialName}`);
        if (partialName.length < 5 && parts.length > 1) {
            partialName = parts[parts.length - 1]; // Try last part
            console.log(`Fallback to fileName last part: ${partialName}`);
        }
    }

    if (!partialName && point.imageUrl) {
        const fileName = point.imageUrl.split('/').pop() || '';
        const baseName = fileName.split('.').slice(0, -1).join('.');
        const parts = baseName.split('_');
        partialName = parts[parts.length - 1]; // e.g., "image_1"
        console.log(`Trying partial name from imageUrl base: ${partialName}`);
    }

    if (!partialName) {
        console.error('Could not determine partial filename for discussion point:', JSON.stringify(point, null, 2));
        alert('Unable to load annotation: Missing filename or image information. Redirecting to manual search.');
        this.router.navigate(['/annotation']);
        return;
    }

    this.router.navigate(['/annotation'], {
        state: {
            partialName: partialName,
            imageUrl: point.imageUrl,
            description: point.description
        }
    });
}

  logout() {
    console.log('Logout button clicked');
    this.timeTracker.stopSessionTracking(true);
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}