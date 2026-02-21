/// <reference types="jest" />
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  NamespaceService,
  ConfirmDialogService,
  SnackBarService,
  DIALOG_RESP,
  STATUS_TYPE,
} from 'kubeflow';
import { of, Subject, throwError } from 'rxjs';
import { GraphInfoComponent } from './graph-info.component';
import { MWABackendService } from 'src/app/services/backend.service';

const mockInferenceGraph: any = {
  kind: 'InferenceGraph',
  metadata: {
    name: 'test-graph',
    namespace: 'kubeflow-user',
    creationTimestamp: '2024-01-01T00:00:00Z',
  },
  spec: {
    nodes: {
      root: {
        routerType: 'Sequence',
        steps: [
          { serviceName: 'sklearn-iris' },
          { serviceName: 'xgboost-iris' },
        ],
      },
    },
  },
  status: {
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: '2024-01-01T00:00:00Z',
      },
    ],
  },
};

const mockEvents = [
  {
    type: 'Normal',
    reason: 'Created',
    message: 'InferenceGraph created successfully',
    lastTimestamp: '2024-01-01T00:00:00Z',
  },
];

describe('GraphInfoComponent (Jest)', () => {
  let component: GraphInfoComponent;
  let fixture: ComponentFixture<GraphInfoComponent>;
  let mockBackendService: any;
  let mockConfirmDialog: any;
  let mockSnackBar: any;
  let mockRouter: any;
  let mockNamespaceService: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockBackendService = {
      getInferenceGraph: jest.fn().mockReturnValue(of(mockInferenceGraph)),
      getInferenceGraphEvents: jest.fn().mockReturnValue(of(mockEvents)),
      deleteInferenceGraph: jest.fn().mockReturnValue(of({})),
      getInferenceGraphYaml: jest.fn().mockReturnValue(of('yaml content')),
    };

    mockNamespaceService = {
      updateSelectedNamespace: jest.fn(),
      getSelectedNamespace: jest.fn().mockReturnValue(of('kubeflow-user')),
    };

    mockConfirmDialog = {
      open: jest.fn().mockReturnValue({
        componentInstance: { applying$: new Subject() },
        afterClosed: () => of(DIALOG_RESP.ACCEPT),
        close: jest.fn(),
      }),
    };

    mockSnackBar = {
      open: jest.fn(),
    };

    mockActivatedRoute = {
      params: of({ namespace: 'kubeflow-user', name: 'test-graph' }),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [GraphInfoComponent],
      imports: [
        HttpClientTestingModule,
        MatSnackBarModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: MWABackendService, useValue: mockBackendService },
        { provide: NamespaceService, useValue: mockNamespaceService },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
        { provide: SnackBarService, useValue: mockSnackBar },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        ChangeDetectorRef,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (component && component['pollingSubscription']) {
      try {
        component['pollingSubscription'].unsubscribe();
      } catch (e) {
        // Ignore unsubscribe errors
      }
    }
    if (fixture) {
      fixture.destroy();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with route params', () => {
    expect(component.graphName).toBe('test-graph');
    expect(component.namespace).toBe('kubeflow-user');
    expect(mockNamespaceService.updateSelectedNamespace).toHaveBeenCalledWith(
      'kubeflow-user',
    );
  });

  it('should load inference graph on init', () => {
    expect(mockBackendService.getInferenceGraph).toHaveBeenCalledWith(
      'kubeflow-user',
      'test-graph',
    );
  });

  it('should have two toolbar buttons (Edit and Delete)', () => {
    expect(component.buttonsConfig.length).toBe(2);
    expect(component.buttonsConfig[0].text).toBe('EDIT');
    expect(component.buttonsConfig[1].text).toBe('DELETE');
  });

  it('should navigate to edit form when edit button is clicked', () => {
    component.buttonsConfig[0].fn();
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/edit-graph',
      'kubeflow-user',
      'test-graph',
    ]);
  });

  it('should show delete confirmation dialog when delete button is clicked', () => {
    component.buttonsConfig[1].fn();
    expect(mockConfirmDialog.open).toHaveBeenCalled();
  });

  it('should delete inference graph when confirmed', fakeAsync(() => {
    const applyingSubject = new Subject<boolean>();
    const mockDialogRef = {
      componentInstance: { applying$: applyingSubject },
      afterClosed: () => of(DIALOG_RESP.ACCEPT),
      close: jest.fn(),
    };
    mockConfirmDialog.open.mockReturnValue(mockDialogRef);

    component.buttonsConfig[1].fn();
    applyingSubject.next(true);
    tick();

    expect(mockBackendService.deleteInferenceGraph).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith(DIALOG_RESP.ACCEPT);
  }));

  it('should navigate back to inference graphs list', () => {
    component.navigateBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/inference-graphs']);
  });

  it('should load graph info and set graphInfoLoaded to true', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(component.graphInfoLoaded).toBe(true);
    expect(component.inferenceGraph).toBeDefined();
  }));

  it('should load events for the inference graph', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(mockBackendService.getInferenceGraphEvents).toHaveBeenCalledWith(
      mockInferenceGraph,
    );
    expect(component.events.length).toBe(1);
    expect(component.events[0].type).toBe('Normal');
  }));

  it('should parse status from inference graph', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(component.status).toBeDefined();
  }));

  it('should expose YAML data', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(component.yaml).toBeDefined();
  }));

  it('should start polling for updates', () => {
    expect(component['poller']).toBeDefined();
  });

  it('should unsubscribe from polling on destroy', fakeAsync(() => {
    tick(100);

    expect(() => component.ngOnDestroy()).not.toThrow();

    if (component['pollingSubscription']) {
      expect(component['pollingSubscription'].closed).toBe(true);
    }
  }));

  it('should handle error when loading graph', fakeAsync(() => {
    mockBackendService.getInferenceGraph.mockReturnValue(
      throwError(() => ({ error: 'Not found' })),
    );

    component['getBackendObjects']();
    tick(200);

    expect(component).toBeTruthy();
    expect(component.graphInfoLoaded).toBe(true);
  }));

  it('should not delete when dialog is cancelled', fakeAsync(() => {
    const applyingSubject = new Subject<boolean>();
    const mockDialogRef = {
      componentInstance: { applying$: applyingSubject },
      afterClosed: () => of(DIALOG_RESP.CANCEL),
      close: jest.fn(),
    };
    mockConfirmDialog.open.mockReturnValue(mockDialogRef);

    component.buttonsConfig[1].fn();
    applyingSubject.next(false);
    tick();

    expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/inference-graphs']);
  }));

  it('should display correct graph metadata', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(component.inferenceGraph.metadata.name).toBe('test-graph');
    expect(component.inferenceGraph.metadata.namespace).toBe('kubeflow-user');
  }));

  it('should display graph spec with nodes', fakeAsync(() => {
    component.ngOnInit();
    tick(100);

    expect(component.inferenceGraph.spec).toBeDefined();
    expect(component.inferenceGraph.spec.nodes).toBeDefined();
    expect(component.inferenceGraph.spec.nodes.root).toBeDefined();
  }));

  it('should handle multiple route changes', fakeAsync(() => {
    const paramsSubject = new Subject();
    mockActivatedRoute.params = paramsSubject.asObservable();

    component.ngOnInit();

    paramsSubject.next({ namespace: 'ns1', name: 'graph1' });
    tick();
    expect(component.namespace).toBe('ns1');
    expect(component.graphName).toBe('graph1');

    paramsSubject.next({ namespace: 'ns2', name: 'graph2' });
    tick();
    expect(component.namespace).toBe('ns2');
    expect(component.graphName).toBe('graph2');
  }));
});
