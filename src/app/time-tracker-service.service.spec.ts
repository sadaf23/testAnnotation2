import { TestBed } from '@angular/core/testing';

import { TimeTrackerServiceService } from './time-tracker-service.service';

describe('TimeTrackerServiceService', () => {
  let service: TimeTrackerServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeTrackerServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
