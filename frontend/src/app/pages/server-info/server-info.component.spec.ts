import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfigService } from 'src/app/services/config.service';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  NamespaceService,
  SnackBarService,
  ConfirmDialogService,
} from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';

import { ServerInfoComponent } from './server-info.component';

let ActivatedRouteStub: Partial<ActivatedRoute>;

ActivatedRouteStub = {
  params: of(),
  queryParams: of({}),
};

describe('ServerInfoComponent', () => {
  let component: ServerInfoComponent;
  let fixture: ComponentFixture<ServerInfoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ServerInfoComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        CommonModule,
        MatIconModule,
        MatDividerModule,
        MatTabsModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        { provide: ActivatedRoute, useValue: ActivatedRouteStub },
        {
          provide: ConfigService,
          useValue: {
            grafanaEndpoints: [],
            getConfig: () => of({ grafanaEndpoints: [] }),
          },
        },
        {
          provide: NamespaceService,
          useValue: {
            getSelectedNamespace: () => of('default'),
          },
        },
        MWABackendService,
        SnackBarService,
        ConfirmDialogService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ServerInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
