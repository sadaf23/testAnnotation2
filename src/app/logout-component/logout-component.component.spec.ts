import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogoutComponentComponent } from './logout-component.component';

describe('LogoutComponentComponent', () => {
  let component: LogoutComponentComponent;
  let fixture: ComponentFixture<LogoutComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoutComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogoutComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
