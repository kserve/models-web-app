import { TestBed } from '@angular/core/testing';

import { GrafanaService } from './grafana.service';

describe('GrafanaService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GrafanaService = TestBed.inject(GrafanaService);
    expect(service).toBeTruthy();
  });
});
