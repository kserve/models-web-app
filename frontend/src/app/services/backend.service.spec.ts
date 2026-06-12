import { TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MWABackendService } from './backend.service';
import { SnackBarService } from 'kubeflow';

describe('MWABackendService', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatSnackBarModule],
      providers: [MWABackendService, SnackBarService],
    }).compileComponents();
  }));

  it('should be created', () => {
    const service = TestBed.inject(MWABackendService);
    expect(service).toBeTruthy();
  });
});
