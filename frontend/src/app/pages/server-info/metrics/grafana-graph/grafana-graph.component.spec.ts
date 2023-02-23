import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { GrafanaGraphComponent } from './grafana-graph.component';
import { GrafanaService } from 'src/app/services/grafana.service';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';

let GrafanaServiceStub: Partial<GrafanaService>;
let DomSanitizerStub: Partial<DomSanitizer>;

GrafanaServiceStub = {
  getDasbhboardUrlFromUri: () => of(),
};

DomSanitizerStub = {
  bypassSecurityTrustResourceUrl: () => of(),
};

describe('GrafanaGraphComponent', () => {
  let component: GrafanaGraphComponent;
  let fixture: ComponentFixture<GrafanaGraphComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [GrafanaGraphComponent],
      imports: [HttpClientTestingModule, MatSnackBarModule],
      providers: [
        { provide: GrafanaService, useValue: GrafanaServiceStub },
        { provide: DomSanitizer, useValue: DomSanitizerStub },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GrafanaGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
