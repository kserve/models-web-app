import { TestBed, waitForAsync } from '@angular/core/testing';
import { BackendService } from 'kubeflow';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('BackendService', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatSnackBarModule],
    }).compileComponents();
  }));
  it('should be created', () => {
    const service: BackendService = TestBed.inject(BackendService);
    expect(service).toBeTruthy();
  });
});
