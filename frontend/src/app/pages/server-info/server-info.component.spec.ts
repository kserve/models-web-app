import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { KubeflowModule } from 'kubeflow';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OverviewModule } from './overview/overview.module';
import { DetailsModule } from './details/details.module';
import { MetricsModule } from './metrics/metrics.module';
import { LogsModule } from './logs/logs.module';
import { YamlsModule } from './yamls/yamls.module';

import { ServerInfoComponent } from './server-info.component';
import { of } from 'rxjs';
import { EventsModule } from './events/events.module';

let ActivatedRouteStub: Partial<ActivatedRoute>;

ActivatedRouteStub = {
  params: of(),
  queryParams: of({}),
};

describe('ServerInfoComponent', () => {
  let component: ServerInfoComponent;
  let fixture: ComponentFixture<ServerInfoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ServerInfoComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        CommonModule,
        KubeflowModule,
        MatIconModule,
        MatDividerModule,
        MatTabsModule,
        MatProgressSpinnerModule,
        OverviewModule,
        DetailsModule,
        MetricsModule,
        LogsModule,
        YamlsModule,
        EventsModule,
      ],
      providers: [{ provide: ActivatedRoute, useValue: ActivatedRouteStub }],
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
});
