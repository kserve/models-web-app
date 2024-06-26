import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ComponentOverviewComponent } from './component.component';
import {
  KubeflowModule,
  ConditionsTableModule,
  DetailsListModule,
  HeadingSubheadingRowModule,
} from 'kubeflow';

describe('ComponentOverviewComponent', () => {
  let component: ComponentOverviewComponent;
  let fixture: ComponentFixture<ComponentOverviewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ComponentOverviewComponent],
      imports: [
        CommonModule,
        KubeflowModule,
        ConditionsTableModule,
        DetailsListModule,
        HeadingSubheadingRowModule,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ComponentOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
