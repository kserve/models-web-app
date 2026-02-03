import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import {
  NamespaceService,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { load, YAMLException, dump } from 'js-yaml';
import { InferenceGraphK8s } from 'src/app/types/kfserving/v1alpha1';
import { MWABackendService } from 'src/app/services/backend.service';

@Component({
  selector: 'app-graph-form',
  templateUrl: './graph-form.component.html',
  styleUrls: ['./graph-form.component.scss'],
})
export class GraphFormComponent implements OnInit {
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

  namespace: string;
  applying = false;
  yamlError: string = '';
  isEditMode = false;
  graphName: string;
  isLoading = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private ns: NamespaceService,
    private snack: SnackBarService,
    private backend: MWABackendService,
  ) {}

  ngOnInit() {
    this.ns.getSelectedNamespace().subscribe(ns => {
      this.namespace = ns;
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
    this.validateYaml();
  }

  validateYaml(): boolean {
    this.yamlError = '';

    if (!this.yaml || this.yaml.trim() === '') {
      this.yamlError = 'YAML content cannot be empty';
      return false;
    }

    try {
      const cr: any = load(this.yaml);

      if (!cr) {
        this.yamlError = 'YAML is empty';
        return false;
      }

      if (!cr.apiVersion) {
        this.yamlError = 'Missing required field: apiVersion';
        return false;
      }

      if (!cr.kind) {
        this.yamlError = 'Missing required field: kind';
        return false;
      }

      if (!cr.metadata) {
        this.yamlError = 'Missing required field: metadata';
        return false;
      }

      if (!cr.metadata.name) {
        this.yamlError = 'Missing required field: metadata.name';
        return false;
      }

      if (!cr.spec) {
        this.yamlError = 'Missing required field: spec';
        return false;
      }

      if (!cr.spec.nodes) {
        this.yamlError = 'Missing required field: spec.nodes';
        return false;
      }

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

  submit() {
    if (!this.validateYaml()) {
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

    let cr: any = {};
    try {
      cr = load(this.yaml);
    } catch (e) {
      let msg = 'Could not parse the provided YAML';

      if (e instanceof Error && e.message) {
        const lineMatch = e.message.match(/line (\d+)/);
        if (lineMatch) {
          msg = `YAML parsing error at line ${lineMatch[1]}: ${e.message}`;
        } else {
          msg = `YAML parsing error: ${e.message}`;
        }
      }

      const config: SnackBarConfig = {
        data: {
          msg,
          snackType: SnackType.Error,
        },
        duration: 16000,
      };
      this.snack.open(config);
      this.applying = false;
      return;
    }

    // Validate parsed object structure
    if (!cr) {
      const config: SnackBarConfig = {
        data: {
          msg: 'YAML is empty or invalid',
          snackType: SnackType.Error,
        },
        duration: 8000,
      };
      this.snack.open(config);
      this.applying = false;
      return;
    }

    const validationErrors: string[] = [];

    if (!cr.apiVersion) {
      validationErrors.push('Missing required field: apiVersion');
    }
    if (!cr.kind || cr.kind !== 'InferenceGraph') {
      validationErrors.push(
        'Missing or invalid field: kind (must be "InferenceGraph")',
      );
    }
    if (!cr.metadata) {
      validationErrors.push('Missing required field: metadata');
    } else {
      if (!cr.metadata.name) {
        validationErrors.push('Missing required field: metadata.name');
      }
    }
    if (!cr.spec) {
      validationErrors.push('Missing required field: spec');
    } else {
      if (!cr.spec.nodes) {
        validationErrors.push('Missing required field: spec.nodes');
      } else if (Object.keys(cr.spec.nodes).length === 0) {
        validationErrors.push(
          'spec.nodes cannot be empty - must define at least one node',
        );
      } else {
        // Validate each node
        for (const nodeName of Object.keys(cr.spec.nodes)) {
          const node = cr.spec.nodes[nodeName];
          if (!node.routerType) {
            validationErrors.push(
              `Node "${nodeName}": missing required field "routerType"`,
            );
          }
          if (!node.steps || !Array.isArray(node.steps)) {
            validationErrors.push(
              `Node "${nodeName}": missing required field "steps" (must be an array)`,
            );
          } else if (node.steps.length === 0) {
            validationErrors.push(
              `Node "${nodeName}": steps array cannot be empty`,
            );
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      const config: SnackBarConfig = {
        data: {
          msg: validationErrors.join(' | '),
          snackType: SnackType.Error,
        },
        duration: 16000,
      };
      this.snack.open(config);
      this.applying = false;
      return;
    }

    cr.metadata.namespace = this.namespace;

    if (this.isEditMode) {
      cr.metadata.name = this.graphName;
    }

    console.log(cr);

    const operation = this.isEditMode
      ? this.backend.editInferenceGraph(this.namespace, this.graphName, cr)
      : this.backend.postInferenceGraph(cr);

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
