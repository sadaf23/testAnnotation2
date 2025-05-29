import { TestBed } from '@angular/core/testing';

import { ImageAnnotationService } from './image-annotation.service';

describe('ImageAnnotationService', () => {
  let service: ImageAnnotationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageAnnotationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
