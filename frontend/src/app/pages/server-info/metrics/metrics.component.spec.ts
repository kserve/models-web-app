import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HeadingSubheadingRowModule, KubeflowModule } from 'kubeflow';
import { ConfigService } from 'src/app/services/config.service';
import { of } from 'rxjs';

import { MetricsComponent } from './metrics.component';

describe('MetricsComponent', () => {
  let component: MetricsComponent;
  let fixture: ComponentFixture<MetricsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [MetricsComponent],
      imports: [CommonModule, KubeflowModule, HeadingSubheadingRowModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            grafanaEndpoints: [],
            getConfig: () => of({ grafanaEndpoints: [] }),
          },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MetricsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
