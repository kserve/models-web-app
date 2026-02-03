import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  NamespaceService,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { load, YAMLException } from 'js-yaml';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { MWABackendService } from 'src/app/services/backend.service';

@Component({
  selector: 'app-submit-form',
  templateUrl: './submit-form.component.html',
  styleUrls: ['./submit-form.component.scss'],
})
export class SubmitFormComponent implements OnInit {
  yaml = '';
  namespace: string;
  applying = false;

  constructor(
    private router: Router,
    private ns: NamespaceService,
    private snack: SnackBarService,
    private backend: MWABackendService,
  ) {}

  ngOnInit() {
    this.ns.getSelectedNamespace().subscribe(ns => {
      this.namespace = ns;
    });
  }

  navigateBack() {
    this.router.navigate(['']);
  }

  submit() {
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
    if (!cr.kind || cr.kind !== 'InferenceService') {
      validationErrors.push(
        'Missing or invalid field: kind (must be "InferenceService")',
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
      if (!cr.spec.predictor) {
        validationErrors.push('Missing required field: spec.predictor');
      } else {
        if (!cr.spec.predictor.model && !cr.spec.predictor.containers) {
          validationErrors.push(
            'spec.predictor must have either "model" or "containers" defined',
          );
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
    console.log(cr);

    this.backend.postInferenceService(cr).subscribe({
      next: () => {
        const config: SnackBarConfig = {
          data: {
            msg: 'InferenceService created successfully.',
            snackType: SnackType.Success,
          },
          duration: 3000,
        };
        this.snack.open(config);
        this.applying = false;
        this.navigateBack();
      },
      error: err => {
        let errorMsg = 'Failed to create InferenceService';

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
