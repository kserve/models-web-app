import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { MWABackendService } from 'src/app/services/backend.service';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  NamespaceService,
  ConfirmDialogService,
  SnackBarService,
} from 'kubeflow';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';
import { IndexComponent } from './index.component';
import { of } from 'rxjs';

let MWABackendServiceStub: Partial<MWABackendService>;
let NamespaceServiceStub: Partial<NamespaceService>;

MWABackendServiceStub = {
  getInferenceServices: () => of(),
  deleteInferenceService: () => of(),
};

NamespaceServiceStub = {
  getSelectedNamespace: () => of(),
  getSelectedNamespace2: () => of(),
};

describe('IndexComponent', () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;

  beforeEach(waitForAsync(() => {
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
        { provide: SnackBarService, useValue: {} },
        { provide: Clipboard, useValue: {} },
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
});
