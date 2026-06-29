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
import { Observable, of, Subject, Subscription } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  NamespaceService,
  SnackBarService,
  ConfirmDialogService,
  STATUS_TYPE,
} from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';
import { SSEService, WatchEvent } from 'src/app/services/sse.service';

import { ServerInfoComponent } from './server-info.component';

describe('ServerInfoComponent', () => {
  let component: ServerInfoComponent;
  let fixture: ComponentFixture<ServerInfoComponent>;
  let routeParams: Subject<{ namespace: string; name: string }>;
  let sseTeardowns: jest.Mock[];
  let sseServiceStub: Partial<SSEService>;
  let watchInferenceServiceMock: jest.Mock;

  beforeEach(waitForAsync(() => {
    routeParams = new Subject<{ namespace: string; name: string }>();
    sseTeardowns = [];
    watchInferenceServiceMock = jest.fn(
      <T>() =>
        new Observable<WatchEvent<T>>(() => {
          const teardown = jest.fn();
          sseTeardowns.push(teardown);
          return teardown;
        }),
    );
    sseServiceStub = {
      watchInferenceService:
        watchInferenceServiceMock as unknown as SSEService['watchInferenceService'],
    };

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
        {
          provide: ActivatedRoute,
          useValue: {
            params: routeParams.asObservable(),
            queryParams: of({}),
          },
        },
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
            updateSelectedNamespace: jest.fn(),
          },
        },
        { provide: SSEService, useValue: sseServiceStub },
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

  it('should return an uninitialized status before the InferenceService loads', () => {
    expect(component.status.phase).toBe(STATUS_TYPE.UNINITIALIZED);
  });

  it('should close the previous SSE stream before route params open a new one', () => {
    routeParams.next({ namespace: 'kubeflow-user', name: 'first-model' });

    expect(watchInferenceServiceMock).toHaveBeenCalledTimes(1);
    expect(sseTeardowns).toHaveLength(1);

    routeParams.next({ namespace: 'kubeflow-user', name: 'second-model' });

    expect(sseTeardowns[0]).toHaveBeenCalledTimes(1);
    expect(watchInferenceServiceMock).toHaveBeenCalledTimes(2);
    expect(sseTeardowns).toHaveLength(2);
  });

  it('should close SSE subscription before polling fallback starts', () => {
    const teardown = jest.fn();
    (component as any).sseSubscription = new Subscription(teardown);

    (component as any).startPolling();

    expect(teardown).toHaveBeenCalled();
    (component as any).pollingSubscription.unsubscribe();
  });
});
