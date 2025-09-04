import { Component, OnInit, Input } from '@angular/core';
import { GrafanaService } from 'src/app/services/grafana.service';
import { ConfigService } from 'src/app/services/config.service';
import { InferenceServiceStatus } from 'src/app/types/kfserving/v1beta1';
import { GrafanaIframeConfig } from 'src/app/types/grafana';
import { AppConfig } from 'src/app/types/config';

@Component({
  selector: 'app-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.scss'],
})
export class MetricsComponent implements OnInit {
  public configs = {
    predictor: [],
    transformer: [],
    explainer: [],
  };

  private cpuMemoryDb: string;
  private httpRequestsDb: string;

  @Input() namespace: string;

  constructor(private configService: ConfigService) {}

  ngOnInit(): void {
    this.configService.getConfig().subscribe(
      config => {
        this.cpuMemoryDb = config.grafanaCpuMemoryDb;
        this.httpRequestsDb = config.grafanaHttpRequestsDb;
        // Regenerate configs if status is already set
        if (this.statusPrv) {
          ['predictor', 'transformer', 'explainer'].forEach(comp => {
            this.configs[comp] = this.generateComponentGraphsConfig(comp);
          });
        }
      },
      error => {
        console.error('Failed to load configuration for MetricsComponent:', error);
        // Use default database names as fallback
        this.cpuMemoryDb = 'db/knative-serving-revision-cpu-and-memory-usage';
        this.httpRequestsDb = 'db/knative-serving-revision-http-requests';
        // Regenerate configs if status is already set
        if (this.statusPrv) {
          ['predictor', 'transformer', 'explainer'].forEach(comp => {
            this.configs[comp] = this.generateComponentGraphsConfig(comp);
          });
        }
      }
    );
  }

  @Input()
  set status(s: InferenceServiceStatus) {
    this.statusPrv = s;

    if (!s) {
      return;
    }

    ['predictor', 'transformer', 'explainer'].forEach(comp => {
      this.configs[comp] = this.generateComponentGraphsConfig(comp);
    });
  }
  get status(): InferenceServiceStatus {
    return this.statusPrv;
  }

  private statusPrv: InferenceServiceStatus;

  public componentHasGraphs(component: string) {
    return this.status && this.status.components[component];
  }

  private getConfigurationForRevision(revision: string): string {
    const tmp = revision.split('-');
    tmp.pop();
    return tmp.join('-');
  }

  private generateComponentGraphsConfig(
    component: string,
  ): GrafanaIframeConfig[] {
    const configs = [];
    if (!this.componentHasGraphs(component)) {
      return [];
    }

    let revision = this.status.components[component].latestReadyRevision;
    if (!revision) {
      revision = this.status.components[component].latestCreatedRevision;
    }

    const config = this.getConfigurationForRevision(revision);

    const cpuConfig = this.generateKnativeCpuRamConfig(2, config, revision);

    const memoryConfig = this.generateKnativeCpuRamConfig(3, config, revision);

    const requestsVolumePerRevision = this.generateKnativeRequestsConfig(
      17,
      config,
      revision,
    );

    const responseTimePerRevision = this.generateKnativeRequestsConfig(
      20,
      config,
      revision,
    );

    const responseVolumePerStatus = this.generateKnativeRequestsConfig(
      18,
      config,
      revision,
    );

    const responseTimePerStatus = this.generateKnativeRequestsConfig(
      21,
      config,
      revision,
    );

    return [
      cpuConfig,
      memoryConfig,
      requestsVolumePerRevision,
      responseTimePerRevision,
      responseVolumePerStatus,
      responseTimePerStatus,
    ];
  }

  // helpers for generating the Grafana configs
  private generateKnativeRequestsConfig(
    panelId: number,
    configuration: string,
    revision: string,
  ): GrafanaIframeConfig {
    const dashboardUri = this.httpRequestsDb || 'db/knative-serving-revision-http-requests';
    return this.generateRevisionGraphConfig(
      panelId,
      450,
      200,
      dashboardUri,
      configuration,
      revision,
    );
  }

  private generateKnativeCpuRamConfig(
    panelId: number,
    configuration: string,
    revision: string,
  ): GrafanaIframeConfig {
    const dashboardUri = this.cpuMemoryDb || 'db/knative-serving-revision-cpu-and-memory-usage';
    return this.generateRevisionGraphConfig(
      panelId,
      450,
      200,
      dashboardUri,
      configuration,
      revision,
    );
  }

  private generateIframeVars(configuration: string, revision: string) {
    return {
      'var-namespace': this.namespace,
      'var-configuration': configuration,
      'var-revision': revision,
    };
  }

  private generateRevisionGraphConfig(
    panelId: number,
    width: number,
    height: number,
    dashboardUri: string,
    conf: string,
    rev: string,
  ): GrafanaIframeConfig {
    return {
      panelId,
      width,
      height,
      dashboardUri,
      vars: this.generateIframeVars(conf, rev),
      componentName: rev,
    };
  }
}
