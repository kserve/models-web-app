import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  KubeflowModule,
  PanelModule,
  LoadingSpinnerModule,
  SnackBarService,
} from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';

import { LogsComponent } from './logs.component';

describe('LogsComponent', () => {
  let component: LogsComponent;
  let fixture: ComponentFixture<LogsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [LogsComponent],
      imports: [
        HttpClientTestingModule,
        MatSnackBarModule,
        MatTabsModule,
        CommonModule,
        KubeflowModule,
        LoadingSpinnerModule,
        PanelModule,
      ],
      providers: [MWABackendService, SnackBarService],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
