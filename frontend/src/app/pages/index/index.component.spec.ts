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
  STATUS_TYPE,
  LinkType,
} from 'kubeflow';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index.component';
import { defaultConfig } from './config';
import { BehaviorSubject, Observable, Observer, of, Subject } from 'rxjs';
import { SSEService, WatchEvent } from 'src/app/services/sse.service';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { Router } from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { BROWSER_WINDOW } from './index.component';

let MWABackendServiceStub: Partial<MWABackendService>;
let NamespaceServiceStub: Partial<NamespaceService>;
let MWANamespaceServiceStub: Partial<MWANamespaceService>;
let SSEServiceStub: Partial<SSEService>;
let sseEvents: Subject<WatchEvent<InferenceServiceK8s>>;
let sseTeardown: jest.Mock;
let snackBarOpen: jest.Mock;
let locationAssign: jest.Mock;
let parentLocationAssign: jest.Mock;
let prepareExternalUrl: jest.Mock;
let browserWindowMock: any;
let dashboardConnectionState: BehaviorSubject<DashboardState>;

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
  let router: Router;

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

  const nameLinkAction = (phase: STATUS_TYPE, event: any) =>
    ({
      action: 'name:link',
      data: {
        metadata: {
          name: 'model-a',
          namespace: 'kubeflow-user',
        },
        ui: {
          status: {
            phase,
          },
        },
      },
      event,
    } as any);

  beforeEach(waitForAsync(() => {
    dashboardConnectionState = new BehaviorSubject<DashboardState>(
      DashboardState.Disconnected,
    );
    sseEvents = new Subject<WatchEvent<InferenceServiceK8s>>();
    sseTeardown = jest.fn();
    snackBarOpen = jest.fn();
    locationAssign = jest.fn();
    parentLocationAssign = jest.fn();
    prepareExternalUrl = jest.fn(path => `/kserve-endpoints${path}`);
    browserWindowMock = {
      location: {
        href: 'http://localhost:8081/kserve-endpoints/',
        assign: locationAssign,
      },
      parent: {
        location: {
          href: 'http://localhost:8081/_/kserve-endpoints/?ns=kubeflow-user',
          assign: parentLocationAssign,
        },
      },
    };
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

    NamespaceServiceStub = {
      getSelectedNamespace: () => of(),
      getSelectedNamespace2: () => of(),
      dashboardConnected$: dashboardConnectionState.asObservable(),
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
        { provide: SnackBarService, useValue: { open: snackBarOpen } },
        { provide: Clipboard, useValue: {} },
        { provide: PollerService, useValue: { exponential: () => of() } },
        {
          provide: LocationStrategy,
          useValue: {
            prepareExternalUrl,
          },
        },
        {
          provide: BROWSER_WINDOW,
          useValue: browserWindowMock,
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  it('should render name links as internal anchors without hover overlays', () => {
    const nameColumn = defaultConfig.columns.find(
      column => column.matColumnDef === 'name',
    );

    expect(nameColumn?.value.linkType).toBe(LinkType.Internal);
    expect(nameColumn?.value.tooltipField).toBe('');
    expect(nameColumn?.value.popoverField).toBe('');
  });

  it('should reload the parent dashboard to the details route for name link actions', () => {
    dashboardConnectionState.next(DashboardState.Connected);
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.reactToAction(nameLinkAction(STATUS_TYPE.READY, event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(prepareExternalUrl).toHaveBeenCalledWith(
      '/details/kubeflow-user/model-a',
    );
    expect(parentLocationAssign).toHaveBeenCalledWith(
      '/_/kserve-endpoints/details/kubeflow-user/model-a?ns=kubeflow-user',
    );
    expect(locationAssign).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should use router navigation when disconnected from the dashboard', () => {
    browserWindowMock.parent = browserWindowMock;
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.reactToAction(nameLinkAction(STATUS_TYPE.READY, event));

    expect(navigateSpy).toHaveBeenCalledWith([
      '/details',
      'kubeflow-user',
      'model-a',
    ]);
    expect(locationAssign).not.toHaveBeenCalled();
    expect(parentLocationAssign).not.toHaveBeenCalled();
  });

  it('should let the browser handle modified name link clicks', () => {
    dashboardConnectionState.next(DashboardState.Connected);
    const event = {
      button: 0,
      ctrlKey: true,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.reactToAction(nameLinkAction(STATUS_TYPE.READY, event));

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(locationAssign).not.toHaveBeenCalled();
    expect(parentLocationAssign).not.toHaveBeenCalled();
  });

  it('should reload the frame directly when parent dashboard location cannot be read', () => {
    dashboardConnectionState.next(DashboardState.Connected);
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    Object.defineProperty(browserWindowMock.parent.location, 'href', {
      get: () => {
        throw new DOMException(
          'Blocked parent location access',
          'SecurityError',
        );
      },
    });

    component.reactToAction(nameLinkAction(STATUS_TYPE.READY, event));

    expect(locationAssign).toHaveBeenCalledWith(
      '/kserve-endpoints/details/kubeflow-user/model-a',
    );
    expect(parentLocationAssign).not.toHaveBeenCalled();
  });

  it('should block navigation for terminating inference service name link actions', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.reactToAction(nameLinkAction(STATUS_TYPE.TERMINATING, event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(locationAssign).not.toHaveBeenCalled();
    expect(parentLocationAssign).not.toHaveBeenCalled();
    expect(snackBarOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          msg: 'Endpoint is being deleted, cannot show details.',
        }),
      }),
    );
  });
});
