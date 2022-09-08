import { TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { GrafanaService } from './grafana.service';

describe('GrafanaService', () => {
  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule, MatSnackBarModule],
      }).compileComponents();
    }),
  );

  it('should be created', () => {
    const service: GrafanaService = TestBed.inject(GrafanaService);
    expect(service).toBeTruthy();
  });
});
