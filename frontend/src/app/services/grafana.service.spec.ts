import { TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SnackBarService } from 'kubeflow';
import { of } from 'rxjs';

import { GrafanaService } from './grafana.service';
import { ConfigService } from './config.service';

describe('GrafanaService', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatSnackBarModule],
      providers: [
        SnackBarService,
        {
          provide: ConfigService,
          useValue: {
            getConfig: () => of({ grafanaPrefix: '/grafana' }),
          },
        },
        GrafanaService,
      ],
    }).compileComponents();
  }));

  it('should be created', () => {
    const service: GrafanaService = TestBed.inject(GrafanaService);
    expect(service).toBeTruthy();
  });
});
