import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LabelAnnotationComponent } from './label-annotation.component';

describe('LabelAnnotationComponent', () => {
  let component: LabelAnnotationComponent;
  let fixture: ComponentFixture<LabelAnnotationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelAnnotationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LabelAnnotationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
