import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';
import { NamespaceService, SnackBarService, DashboardState } from 'kubeflow';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import { SubmitFormComponent } from './submit-form.component';
import { of } from 'rxjs';

let MWABackendServiceStub: Partial<MWABackendService>;
let NamespaceServiceStub: Partial<NamespaceService>;
let MWANamespaceServiceStub: Partial<MWANamespaceService>;

MWABackendServiceStub = {
  postInferenceService: () => of(),
};

NamespaceServiceStub = {
  getSelectedNamespace: () => of(),
  dashboardConnected$: of(DashboardState.Disconnected),
};

MWANamespaceServiceStub = {
  getSelectedNamespace: () => of('kubeflow-user'),
  initialize: () => of(''),
};

describe('SubmitFormComponent', () => {
  let component: SubmitFormComponent;
  let fixture: ComponentFixture<SubmitFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SubmitFormComponent],
      imports: [RouterTestingModule, CommonModule, KubeflowModule],
      providers: [
        { provide: MWABackendService, useValue: MWABackendServiceStub },
        { provide: NamespaceService, useValue: NamespaceServiceStub },
        { provide: MWANamespaceService, useValue: MWANamespaceServiceStub },
        { provide: SnackBarService, useValue: {} },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
