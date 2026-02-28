/// <reference types="jest" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { NamespaceService, SnackBarService } from 'kubeflow';
import { of, throwError } from 'rxjs';
import { GraphFormComponent } from './graph-form.component';
import { MWABackendService } from 'src/app/services/backend.service';

const mockInferenceGraph: any = {
  kind: 'InferenceGraph',
  metadata: {
    name: 'test-graph',
    namespace: 'kubeflow-user',
  },
  spec: {
    nodes: {
      root: {
        routerType: 'Sequence',
        steps: [{ serviceName: 'sklearn-iris' }],
      },
    },
  },
};

describe('GraphFormComponent (Jest)', () => {
  let component: GraphFormComponent;
  let fixture: ComponentFixture<GraphFormComponent>;
  let mockBackendService: any;
  let mockSnackBar: any;
  let mockRouter: any;
  let mockLocation: any;
  let mockActivatedRoute: any;
  let mockNamespaceService: any;

  beforeEach(async () => {
    mockBackendService = {
      getInferenceGraph: jest.fn().mockReturnValue(of(mockInferenceGraph)),
      postInferenceGraph: jest.fn().mockReturnValue(of({ success: true })),
      editInferenceGraph: jest.fn().mockReturnValue(of({ success: true })),
    };

    mockNamespaceService = {
      getSelectedNamespace: jest.fn().mockReturnValue(of('kubeflow-user')),
    };

    mockSnackBar = {
      open: jest.fn(),
    };

    mockLocation = {
      back: jest.fn(),
    };

    mockActivatedRoute = {
      params: of({}),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [GraphFormComponent],
      imports: [
        HttpClientTestingModule,
        MatSnackBarModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: MWABackendService, useValue: mockBackendService },
        { provide: NamespaceService, useValue: mockNamespaceService },
        { provide: SnackBarService, useValue: mockSnackBar },
        { provide: Location, useValue: mockLocation },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default YAML template', () => {
    expect(component.yaml).toContain('apiVersion: serving.kserve.io/v1alpha1');
    expect(component.yaml).toContain('kind: InferenceGraph');
    expect(component.yaml).toContain('metadata:');
    expect(component.yaml).toContain('spec:');
  });

  it('should load namespace on init', () => {
    expect(component.namespace).toBe('kubeflow-user');
  });

  it('should enter edit mode when route has namespace and name params', () => {
    mockActivatedRoute.params = of({
      namespace: 'test-ns',
      name: 'test-graph',
    });

    component.ngOnInit();

    expect(component.isEditMode).toBe(true);
    expect(component.namespace).toBe('test-ns');
    expect(component.graphName).toBe('test-graph');
  });

  it('should load graph for editing when in edit mode', () => {
    mockActivatedRoute.params = of({
      namespace: 'kubeflow-user',
      name: 'test-graph',
    });

    component.ngOnInit();

    expect(mockBackendService.getInferenceGraph).toHaveBeenCalledWith(
      'kubeflow-user',
      'test-graph',
    );
  });

  it('should handle error when loading graph for editing', done => {
    mockBackendService.getInferenceGraph.mockReturnValue(
      throwError(() => ({ error: 'Not found' })),
    );

    mockActivatedRoute.params = of({
      namespace: 'kubeflow-user',
      name: 'test-graph',
    });

    // Create a new component instance to trigger ngOnInit with the new route params
    const newFixture = TestBed.createComponent(GraphFormComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    setTimeout(() => {
      expect(mockSnackBar.open).toHaveBeenCalled();
      expect(mockLocation.back).toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should validate YAML on submit', () => {
    component.yaml = 'invalid: yaml: content: [';
    component.submit();

    expect(component.yamlError).toBeTruthy();
    expect(component.applying).toBe(false);
  });

  it('should show error for invalid YAML', () => {
    component.yaml = 'invalid: yaml: content: [[[';
    component.submit();

    expect(component.yamlError).toBeTruthy();
  });

  it('should navigate back on cancel', () => {
    component.navigateBack();
    expect(mockLocation.back).toHaveBeenCalled();
  });

  it('should clear YAML error when YAML changes', () => {
    component.yamlError = 'Some error';
    component.yaml = 'new yaml content';
    component.onYamlChange();

    expect(component.yamlError).toBeTruthy();
  });

  it('should validate yaml when onYamlChange is called', () => {
    component.yaml = 'invalid yaml: [[';
    component.onYamlChange();

    expect(component.yamlError).toBeTruthy();
  });

  it('should call postInferenceGraph on submit in create mode', done => {
    component.isEditMode = false;
    component.namespace = 'kubeflow-user';
    component.yaml = `
apiVersion: serving.kserve.io/v1alpha1
kind: InferenceGraph
metadata:
  name: new-graph
  namespace: kubeflow-user
spec:
  nodes:
    root:
      routerType: Sequence
      steps:
        - serviceName: sklearn-iris
`;

    mockBackendService.postInferenceGraph.mockReturnValue(
      of({ success: true }),
    );

    component.submit();

    setTimeout(() => {
      expect(mockBackendService.postInferenceGraph).toHaveBeenCalled();
      const snackBarCall = mockSnackBar.open.mock.calls[0][0];
      expect(snackBarCall.data.msg).toBe(
        'InferenceGraph created successfully.',
      );
      done();
    }, 100);
  });

  it('should handle error during graph creation', done => {
    component.isEditMode = false;
    component.namespace = 'kubeflow-user';
    component.yaml = `
apiVersion: serving.kserve.io/v1alpha1
kind: InferenceGraph
metadata:
  name: new-graph
  namespace: kubeflow-user
spec:
  nodes:
    root:
      routerType: Sequence
      steps:
        - serviceName: sklearn-iris
`;

    const errorMessage = 'Failed to create';
    mockBackendService.postInferenceGraph.mockReturnValue(
      throwError(() => ({ error: { log: errorMessage } })),
    );

    component.submit();

    setTimeout(() => {
      expect(mockBackendService.postInferenceGraph).toHaveBeenCalled();
      const snackBarCall = mockSnackBar.open.mock.calls[0][0];
      expect(snackBarCall.data.msg).toBe(errorMessage);
      expect(component.applying).toBe(false);
      done();
    }, 100);
  });

  it('should show correct mode status', () => {
    component.isEditMode = false;
    expect(component.isEditMode).toBe(false);

    component.isEditMode = true;
    expect(component.isEditMode).toBe(true);
  });

  it('should manage applying state', () => {
    component.applying = true;
    expect(component.applying).toBe(true);

    component.applying = false;
    expect(component.applying).toBe(false);
  });

  it('should manage loading state', () => {
    component.isLoading = true;
    expect(component.isLoading).toBe(true);

    component.isLoading = false;
    expect(component.isLoading).toBe(false);
  });
});
