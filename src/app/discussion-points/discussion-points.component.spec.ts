import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscussionPointsComponent } from './discussion-points.component';

describe('DiscussionPointsComponent', () => {
  let component: DiscussionPointsComponent;
  let fixture: ComponentFixture<DiscussionPointsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscussionPointsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiscussionPointsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
