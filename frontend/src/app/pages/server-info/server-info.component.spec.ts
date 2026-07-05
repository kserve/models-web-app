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
import {
  firstValueFrom,
  Observable,
  Observer,
  of,
  Subject,
  Subscription,
  throwError,
} from 'rxjs';
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
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

describe('ServerInfoComponent', () => {
  let component: ServerInfoComponent;
  let fixture: ComponentFixture<ServerInfoComponent>;
  let routeParams: Subject<{ namespace: string; name: string }>;
  let sseTeardowns: jest.Mock[];
  let sseEvents: Subject<WatchEvent<InferenceServiceK8s>>;
  let sseServiceStub: Partial<SSEService>;
  let watchInferenceServiceMock: jest.Mock;
  let backend: MWABackendService;

  const serverlessInferenceService = (
    latestCreatedRevision?: string,
  ): InferenceServiceK8s => ({
    kind: 'InferenceService',
    apiVersion: 'serving.kserve.io/v1beta1',
    metadata: {
      name: 'sklearn-iris',
      namespace: 'kubeflow-user',
    },
    spec: {
      predictor: {
        sklearn: {
          storageUri: 's3://models/sklearn-iris',
        },
      },
      explainer: {},
      transformer: {},
    } as any,
    status: {
      components: {
        predictor: latestCreatedRevision ? { latestCreatedRevision } : {},
      },
    } as any,
  });

  beforeEach(waitForAsync(() => {
    routeParams = new Subject<{ namespace: string; name: string }>();
    sseEvents = new Subject<WatchEvent<InferenceServiceK8s>>();
    sseTeardowns = [];
    watchInferenceServiceMock = jest.fn(
      <T>() =>
        new Observable<WatchEvent<T>>(observer => {
          const subscription = sseEvents.subscribe(
            observer as unknown as Observer<WatchEvent<InferenceServiceK8s>>,
          );
          const teardown = jest.fn();
          sseTeardowns.push(teardown);
          return () => {
            teardown();
            subscription.unsubscribe();
          };
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
    backend = TestBed.inject(MWABackendService);
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

  it('should return empty serverless owned objects when the latest revision is missing', async () => {
    const getRevisionSpy = jest
      .spyOn(backend, 'getKnativeRevision')
      .mockReturnValue(throwError(() => new Error('should not be called')));
    component.namespace = 'kubeflow-user';

    const result = await firstValueFrom(
      (component as any).getOwnedObjects(
        serverlessInferenceService(),
        'predictor',
      ),
    );

    expect(getRevisionSpy).not.toHaveBeenCalled();
    expect(result).toEqual(['predictor', {}]);
  });

  it('should return empty serverless owned objects when a Knative lookup fails', async () => {
    jest
      .spyOn(backend, 'getKnativeRevision')
      .mockReturnValue(throwError(() => new Error('revision failed')));
    component.namespace = 'kubeflow-user';

    const result = await firstValueFrom(
      (component as any).getOwnedObjects(
        serverlessInferenceService('sklearn-iris-predictor-00001'),
        'predictor',
      ),
    );

    expect(result).toEqual(['predictor', {}]);
  });

  it('should request change detection after an SSE update loads owned objects', () => {
    const cdr = (component as any).cdr;
    expect(cdr).toBeDefined();
    const detectChangesSpy = jest
      .spyOn(cdr, 'detectChanges')
      .mockImplementation(() => undefined);

    routeParams.next({ namespace: 'kubeflow-user', name: 'sklearn-iris' });
    sseEvents.next({
      type: 'INITIAL',
      object: serverlessInferenceService(),
    });

    expect(component.serverInfoLoaded).toBe(true);
    expect(detectChangesSpy).toHaveBeenCalled();
  });
});
