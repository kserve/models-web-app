/// <reference types="jest" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import {
  NamespaceService,
  ConfirmDialogService,
  SnackBarService,
  PollerService,
  STATUS_TYPE,
  DIALOG_RESP,
} from 'kubeflow';
import { InferenceGraphComponent } from './inference-graph.component';
import { of, Subject } from 'rxjs';
import { Router } from '@angular/router';
import {
  InferenceGraphK8s,
  InferenceGraphIR,
} from 'src/app/types/kfserving/v1alpha1';

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
        steps: [{ serviceName: 'sklearn-iris' }],
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

describe('InferenceGraphComponent (Jest)', () => {
  let component: InferenceGraphComponent;
  let fixture: ComponentFixture<InferenceGraphComponent>;
  let mockBackendService: any;
  let mockConfirmDialog: any;
  let mockRouter: any;
  let mockSnackBar: any;
  let mockPoller: any;
  let mockNamespaceService: any;
  let mockMWANamespaceService: any;

  beforeEach(async () => {
    mockBackendService = {
      getInferenceGraphs: jest.fn().mockReturnValue(of([mockInferenceGraph])),
      deleteInferenceGraph: jest.fn().mockReturnValue(of({})),
    };

    mockNamespaceService = {
      getSelectedNamespace: jest.fn().mockReturnValue(of('kubeflow-user')),
    };

    mockMWANamespaceService = {
      initialize: jest.fn().mockReturnValue(of('')),
      getSelectedNamespace: jest.fn().mockReturnValue(of('kubeflow-user')),
      getNamespaceConfig$: jest.fn().mockReturnValue(
        of({
          namespaces: ['kubeflow-user'],
          allowedNamespaces: ['kubeflow-user'],
          isSingleNamespace: true,
          autoSelectedNamespace: 'kubeflow-user',
        }),
      ),
    };

    mockConfirmDialog = {
      open: jest.fn().mockReturnValue({
        componentInstance: { applying$: new Subject() },
        afterClosed: () => of(DIALOG_RESP.ACCEPT),
      }),
    };

    mockSnackBar = {
      open: jest.fn(),
    };

    mockPoller = {
      exponential: jest.fn().mockReturnValue(of([mockInferenceGraph])),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [InferenceGraphComponent],
      imports: [
        HttpClientTestingModule,
        MatSnackBarModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: MWABackendService, useValue: mockBackendService },
        { provide: NamespaceService, useValue: mockNamespaceService },
        { provide: MWANamespaceService, useValue: mockMWANamespaceService },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
        { provide: SnackBarService, useValue: mockSnackBar },
        { provide: PollerService, useValue: mockPoller },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InferenceGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with namespace', () => {
    expect(component.currentNamespace).toBe('kubeflow-user');
  });

  it('should have toolbar buttons', () => {
    expect(component.buttons.length).toBe(2);
    expect(component.buttons[0].text).toBe('View Endpoints');
    expect(component.buttons[1].text).toBe('New InferenceGraph');
  });

  it('should navigate to new graph form when new graph button is clicked', () => {
    component.buttons[1].fn();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/new-graph']);
  });

  it('should navigate to endpoints when view endpoints button is clicked', () => {
    component.buttons[0].fn();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should poll for inference graphs', () => {
    component.poll('kubeflow-user');
    expect(mockBackendService.getInferenceGraphs).toHaveBeenCalledWith(
      'kubeflow-user',
    );
  });

  it('should handle delete action', () => {
    const mockGraph: any = {
      ...mockInferenceGraph,
      ui: {
        actions: { delete: STATUS_TYPE.READY },
        status: { phase: STATUS_TYPE.READY, state: '', message: '' },
        routerType: 'Sequence',
        nodeCount: 1,
      },
    };

    const event = { action: 'delete', data: mockGraph };
    component.reactToAction(event as any);

    expect(mockConfirmDialog.open).toHaveBeenCalled();
  });

  it('should prevent navigation to details page when graph is terminating', () => {
    const mockGraph: any = {
      ...mockInferenceGraph,
      ui: {
        actions: {},
        status: { phase: STATUS_TYPE.TERMINATING, state: '', message: '' },
        routerType: 'Sequence',
        nodeCount: 1,
      },
    };

    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    };

    const event = { action: 'name:link', data: mockGraph, event: mockEvent };
    component.reactToAction(event as any);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalled();
  });

  it('should process inference graphs correctly', () => {
    component.poll('kubeflow-user');
    fixture.detectChanges();

    expect(component.inferenceGraphs.length).toBeGreaterThan(0);
    if (component.inferenceGraphs.length > 0) {
      const graph = component.inferenceGraphs[0];
      expect(graph.ui).toBeDefined();
      expect(graph.ui.status).toBeDefined();
      expect(graph.ui.link).toBeDefined();
    }
  });

  it('should track inference graphs by name and creation timestamp', () => {
    const trackByResult = component.inferenceGraphTrackByFn(
      0,
      mockInferenceGraph as any,
    );
    expect(trackByResult).toContain('test-graph');
  });

  it('should unsubscribe on destroy', () => {
    const namespaceUnsubscribe = jest.spyOn(
      component['namespaceSubscription'],
      'unsubscribe',
    );
    const pollingUnsubscribe = jest.spyOn(
      component['pollingSubscription'],
      'unsubscribe',
    );

    component.ngOnDestroy();

    expect(namespaceUnsubscribe).toHaveBeenCalled();
    expect(pollingUnsubscribe).toHaveBeenCalled();
  });

  it('should update polling when namespace changes', () => {
    const newNamespace = 'another-namespace';
    component.poll(newNamespace);

    expect(mockBackendService.getInferenceGraphs).toHaveBeenCalledWith(
      newNamespace,
    );
  });

  it('should parse inference graph with router type and node count', () => {
    component.poll('kubeflow-user');
    fixture.detectChanges();

    if (component.inferenceGraphs.length > 0) {
      const graph = component.inferenceGraphs[0];
      expect(graph.ui.routerType).toBeDefined();
      expect(graph.ui.nodeCount).toBeDefined();
    }
  });
});
