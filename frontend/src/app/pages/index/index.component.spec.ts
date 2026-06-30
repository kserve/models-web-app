import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  NamespaceService,
  ConfirmDialogService,
  SnackBarService,
  PollerService,
  KubeflowModule,
  DashboardState,
} from 'kubeflow';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index.component';
import { Observable, Observer, of, Subject } from 'rxjs';
import { SSEService, WatchEvent } from 'src/app/services/sse.service';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';

let MWABackendServiceStub: Partial<MWABackendService>;
let NamespaceServiceStub: Partial<NamespaceService>;
let MWANamespaceServiceStub: Partial<MWANamespaceService>;
let SSEServiceStub: Partial<SSEService>;
let sseEvents: Subject<WatchEvent<InferenceServiceK8s>>;
let sseTeardown: jest.Mock;

MWABackendServiceStub = {
  getInferenceServices: () => of(),
  deleteInferenceService: () => of(),
};

NamespaceServiceStub = {
  getSelectedNamespace: () => of(),
  getSelectedNamespace2: () => of(),
  dashboardConnected$: of(DashboardState.Disconnected),
};

MWANamespaceServiceStub = {
  initialize: () => of(''),
  getSelectedNamespace: () => of('kubeflow-user'),
  getNamespaceConfig$: () =>
    of({
      namespaces: ['kubeflow-user'],
      allowedNamespaces: ['kubeflow-user'],
      isSingleNamespace: true,
      autoSelectedNamespace: 'kubeflow-user',
    }),
};

describe('IndexComponent', () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;

  const inferenceService = (
    name: string,
    url = `http://${name}.example.com`,
  ): InferenceServiceK8s => ({
    kind: 'InferenceService',
    apiVersion: 'serving.kserve.io/v1beta1',
    metadata: {
      name,
      namespace: 'kubeflow-user',
    },
    spec: {
      predictor: {
        sklearn: {
          storageUri: `s3://models/${name}`,
        },
      },
      explainer: {},
      transformer: {},
    } as any,
    status: {
      url,
      conditions: [
        {
          type: 'Ready',
          status: 'True',
        },
      ],
    } as any,
  });

  beforeEach(waitForAsync(() => {
    sseEvents = new Subject<WatchEvent<InferenceServiceK8s>>();
    sseTeardown = jest.fn();
    SSEServiceStub = {
      watchInferenceServices: <T>() =>
        new Observable<WatchEvent<T>>(observer => {
          const subscription = sseEvents.subscribe(
            observer as unknown as Observer<WatchEvent<InferenceServiceK8s>>,
          );
          return () => {
            sseTeardown();
            subscription.unsubscribe();
          };
        }),
    };

    TestBed.configureTestingModule({
      declarations: [IndexComponent],
      imports: [
        HttpClientTestingModule,
        MatSnackBarModule,
        RouterTestingModule,
        CommonModule,
        KubeflowModule,
      ],
      providers: [
        { provide: ConfirmDialogService, useValue: {} },
        { provide: MWABackendService, useValue: MWABackendServiceStub },
        { provide: NamespaceService, useValue: NamespaceServiceStub },
        { provide: MWANamespaceService, useValue: MWANamespaceServiceStub },
        { provide: SSEService, useValue: SSEServiceStub },
        { provide: SnackBarService, useValue: {} },
        { provide: Clipboard, useValue: {} },
        { provide: PollerService, useValue: { exponential: () => of() } },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close SSE subscription before polling fallback on SSE error events', () => {
    sseEvents.next({ type: 'ERROR', message: 'watch failed' });

    expect(sseTeardown).toHaveBeenCalled();
  });

  it('should replace inference services from an INITIAL SSE event', () => {
    sseEvents.next({
      type: 'INITIAL',
      items: [inferenceService('model-a'), inferenceService('model-b')],
    });

    expect(component.inferenceServices.map(svc => svc.metadata?.name)).toEqual([
      'model-a',
      'model-b',
    ]);
  });

  it('should append inference services from ADDED SSE events', () => {
    sseEvents.next({
      type: 'INITIAL',
      items: [inferenceService('model-a')],
    });

    sseEvents.next({
      type: 'ADDED',
      object: inferenceService('model-b'),
    });

    expect(component.inferenceServices.map(svc => svc.metadata?.name)).toEqual([
      'model-a',
      'model-b',
    ]);
  });

  it('should update matching inference services from MODIFIED SSE events', () => {
    sseEvents.next({
      type: 'INITIAL',
      items: [inferenceService('model-a', 'http://old.example.com')],
    });

    sseEvents.next({
      type: 'MODIFIED',
      object: inferenceService('model-a', 'http://new.example.com'),
    });

    expect(component.inferenceServices).toHaveLength(1);
    expect(component.inferenceServices[0].status?.url).toBe(
      'http://new.example.com',
    );
  });

  it('should remove matching inference services from DELETED SSE events', () => {
    sseEvents.next({
      type: 'INITIAL',
      items: [inferenceService('model-a'), inferenceService('model-b')],
    });

    sseEvents.next({
      type: 'DELETED',
      object: inferenceService('model-a'),
    });

    expect(component.inferenceServices.map(svc => svc.metadata?.name)).toEqual([
      'model-b',
    ]);
  });
});
