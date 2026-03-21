import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import {
  NamespaceService,
  DashboardState,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { load, dump } from 'js-yaml';
import { InferenceGraphK8s } from 'src/app/types/kfserving/v1alpha1';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-graph-form',
  templateUrl: './graph-form.component.html',
  styleUrls: ['./graph-form.component.scss'],
})
export class GraphFormComponent implements OnInit, OnDestroy {
  yaml = `apiVersion: serving.kserve.io/v1alpha1
kind: InferenceGraph
metadata:
  name: my-graph
spec:
  nodes:
    root:
      routerType: Sequence
      steps:
        - serviceName: sklearn-iris`;

  namespace!: string;
  applying = false;
  yamlError: string = '';
  isEditMode = false;
  graphName!: string;
  isLoading = false;

  private namespaceSubscription = new Subscription();
  private dashboardSubscription = new Subscription();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private namespaceService: NamespaceService,
    private mwaNamespace: MWANamespaceService,
    private snack: SnackBarService,
    private backend: MWABackendService,
  ) {}

  ngOnInit() {
    this.dashboardSubscription =
      this.namespaceService.dashboardConnected$.subscribe(dashboardState => {
        this.namespaceSubscription.unsubscribe();

        if (dashboardState === DashboardState.Disconnected) {
          this.mwaNamespace.initialize().subscribe();
          this.namespaceSubscription = this.mwaNamespace
            .getSelectedNamespace()
            .subscribe(namespace => {
              this.namespace = namespace;
            });
        } else {
          this.namespaceSubscription = this.namespaceService
            .getSelectedNamespace()
            .subscribe(namespace => {
              this.namespace = namespace;
            });
        }
      });

    this.route.params.subscribe(params => {
      if (params['namespace'] && params['name']) {
        this.isEditMode = true;
        this.namespace = params['namespace'];
        this.graphName = params['name'];
        this.loadGraphForEditing();
      }
    });
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.dashboardSubscription.unsubscribe();
  }

  private loadGraphForEditing() {
    this.isLoading = true;
    this.backend.getInferenceGraph(this.namespace, this.graphName).subscribe(
      (graph: InferenceGraphK8s) => {
        this.yaml = dump(graph);
        this.isLoading = false;
      },
      err => {
        console.error('Error loading graph for editing:', err);
        const config: SnackBarConfig = {
          data: {
            msg: 'Failed to load InferenceGraph for editing',
            snackType: SnackType.Error,
          },
          duration: 5000,
        };
        this.snack.open(config);
        this.isLoading = false;
        this.navigateBack();
      },
    );
  }

  navigateBack() {
    this.location.back();
  }

  onYamlChange() {
    this.validateYamlSyntax();
  }

  validateYamlSyntax(): boolean {
    this.yamlError = '';

    if (!this.yaml || this.yaml.trim() === '') {
      this.yamlError = 'YAML content cannot be empty';
      return false;
    }

    try {
      load(this.yaml);
      return true;
    } catch (e) {
      let msg = 'Could not parse YAML';

      if (e instanceof Error) {
        if (e.message.includes('line')) {
          msg = `YAML parsing error: ${e.message}`;
        } else {
          msg = `YAML Error: ${e.message}`;
        }
      }

      this.yamlError = msg;
      return false;
    }
  }

  validateYaml(): InferenceGraphK8s | null {
    this.yamlError = '';

    if (!this.yaml || this.yaml.trim() === '') {
      this.yamlError = 'YAML content cannot be empty';
      return null;
    }

    try {
      const customResource = load(this.yaml) as InferenceGraphK8s;

      if (!customResource) {
        this.yamlError = 'YAML is empty';
        return null;
      }

      if (!customResource.apiVersion) {
        this.yamlError = 'Missing required field: apiVersion';
        return null;
      }

      if (!customResource.kind) {
        this.yamlError = 'Missing required field: kind';
        return null;
      }

      if (customResource.kind !== 'InferenceGraph') {
        this.yamlError = 'Invalid field: kind must be "InferenceGraph"';
        return null;
      }

      if (!customResource.metadata) {
        this.yamlError = 'Missing required field: metadata';
        return null;
      }

      if (!customResource.metadata.name) {
        this.yamlError = 'Missing required field: metadata.name';
        return null;
      }

      if (!customResource.spec) {
        this.yamlError = 'Missing required field: spec';
        return null;
      }

      if (!customResource.spec.nodes) {
        this.yamlError = 'Missing required field: spec.nodes';
        return null;
      }

      if (Object.keys(customResource.spec.nodes).length === 0) {
        this.yamlError =
          'spec.nodes cannot be empty - must define at least one node';
        return null;
      }

      for (const nodeName of Object.keys(customResource.spec.nodes)) {
        const node = customResource.spec.nodes[nodeName];
        if (!node.routerType) {
          this.yamlError = `Node "${nodeName}": missing required field "routerType"`;
          return null;
        }
        if (!node.steps || !Array.isArray(node.steps)) {
          this.yamlError = `Node "${nodeName}": missing required field "steps" (must be an array)`;
          return null;
        }
        if (node.steps.length === 0) {
          this.yamlError = `Node "${nodeName}": steps array cannot be empty`;
          return null;
        }
      }

      return customResource;
    } catch (e) {
      let msg = 'Could not parse YAML';

      if (e instanceof Error) {
        if (e.message.includes('line')) {
          msg = `YAML parsing error: ${e.message}`;
        } else {
          msg = `YAML Error: ${e.message}`;
        }
      }

      this.yamlError = msg;
      return null;
    }
  }

  submit() {
    const customResource = this.validateYaml();

    if (!customResource) {
      const config: SnackBarConfig = {
        data: {
          msg: this.yamlError,
          snackType: SnackType.Error,
        },
        duration: 16000,
      };
      this.snack.open(config);
      return;
    }

    this.applying = true;

    customResource.metadata.namespace = this.namespace;

    if (this.isEditMode) {
      customResource.metadata.name = this.graphName;
    }

    const operation = this.isEditMode
      ? this.backend.editInferenceGraph(
          this.namespace,
          this.graphName,
          customResource,
        )
      : this.backend.postInferenceGraph(customResource);

    operation.subscribe({
      next: () => {
        const successMsg = this.isEditMode
          ? 'InferenceGraph updated successfully.'
          : 'InferenceGraph created successfully.';
        const config: SnackBarConfig = {
          data: {
            msg: successMsg,
            snackType: SnackType.Success,
          },
          duration: 3000,
        };
        this.snack.open(config);
        this.applying = false;
        this.navigateBack();
      },
      error: err => {
        let errorMsg = this.isEditMode
          ? 'Failed to update InferenceGraph'
          : 'Failed to create InferenceGraph';

        if (err?.error?.log) {
          errorMsg = err.error.log;
        } else if (err?.error?.message) {
          errorMsg = err.error.message;
        } else if (err?.error?.error) {
          errorMsg = err.error.error;
        } else if (typeof err?.error === 'string') {
          errorMsg = err.error;
        } else if (err?.statusText) {
          errorMsg = `Server error: ${err.statusText}`;
        }

        const config: SnackBarConfig = {
          data: {
            msg: errorMsg,
            snackType: SnackType.Error,
          },
          duration: 16000,
        };
        this.snack.open(config);
        this.applying = false;
      },
    });
  }
}
