import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  NamespaceService,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { loadAll } from 'js-yaml';
import { forkJoin, Observable } from 'rxjs';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { TrainedModelK8s } from 'src/app/types/kfserving/v1alpha1';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWABackendResponse } from 'src/app/types/backend';

@Component({
  selector: 'app-submit-form',
  templateUrl: './submit-form.component.html',
  styleUrls: ['./submit-form.component.scss'],
})
export class SubmitFormComponent implements OnInit {
  yaml = '';
  namespace!: string;
  applying = false;

  constructor(
    private router: Router,
    private namespaceService: NamespaceService,
    private snack: SnackBarService,
    private backend: MWABackendService,
  ) {}

  ngOnInit() {
    this.namespaceService.getSelectedNamespace().subscribe(namespace => {
      this.namespace = namespace;
    });
  }

  navigateBack() {
    this.router.navigate(['']);
  }

  submit() {
    this.applying = true;

    let docs: unknown[];
    try {
      docs = loadAll(this.yaml);
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

      this.showError(msg);
      this.applying = false;
      return;
    }

    const validDocs = docs.filter(d => d != null);
    if (validDocs.length === 0) {
      this.showError('YAML is empty or invalid');
      this.applying = false;
      return;
    }

    const validationErrors: string[] = [];
    const inferenceServices: InferenceServiceK8s[] = [];
    const trainedModels: TrainedModelK8s[] = [];

    for (const doc of validDocs) {
      const resource = doc as any;
      const kind = resource?.kind;

      if (kind === 'InferenceService') {
        validationErrors.push(...this.validateInferenceService(resource));
        inferenceServices.push(resource as InferenceServiceK8s);
      } else if (kind === 'TrainedModel') {
        validationErrors.push(...this.validateTrainedModel(resource));
        trainedModels.push(resource as TrainedModelK8s);
      } else {
        validationErrors.push(
          `Unsupported resource kind: "${
            kind || 'unknown'
          }". Only InferenceService and TrainedModel are supported.`,
        );
      }
    }

    if (inferenceServices.length === 0) {
      validationErrors.push(
        'At least one InferenceService document is required.',
      );
    }

    if (inferenceServices.length > 1) {
      validationErrors.push(
        'Only one InferenceService document is allowed per submission.',
      );
    }

    if (validationErrors.length > 0) {
      this.showError(validationErrors.join(' | '), 16000);
      this.applying = false;
      return;
    }

    const requests: Observable<MWABackendResponse>[] = [];

    for (const svc of inferenceServices) {
      svc.metadata!.namespace = this.namespace;
      requests.push(this.backend.postInferenceService(svc));
    }

    for (const tm of trainedModels) {
      if (!tm.metadata) {
        tm.metadata = {};
      }
      tm.metadata.namespace = this.namespace;
      requests.push(this.backend.postTrainedModel(tm));
    }

    forkJoin(requests).subscribe({
      next: () => {
        const total = inferenceServices.length + trainedModels.length;
        const msg =
          total === 1
            ? 'InferenceService created successfully.'
            : `${total} resources created successfully.`;
        this.showSuccess(msg);
        this.applying = false;
        this.navigateBack();
      },
      error: err => {
        let errorMsg = 'Failed to create resources';

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

        this.showError(errorMsg, 16000);
        this.applying = false;
      },
    });
  }

  private validateInferenceService(resource: any): string[] {
    const errors: string[] = [];
    if (!resource.apiVersion) {
      errors.push('InferenceService: Missing required field: apiVersion');
    }
    if (!resource.metadata) {
      errors.push('InferenceService: Missing required field: metadata');
    } else if (!resource.metadata.name) {
      errors.push('InferenceService: Missing required field: metadata.name');
    }
    if (!resource.spec) {
      errors.push('InferenceService: Missing required field: spec');
    } else if (!resource.spec.predictor) {
      errors.push('InferenceService: Missing required field: spec.predictor');
    }
    return errors;
  }

  private validateTrainedModel(resource: any): string[] {
    const errors: string[] = [];
    if (!resource.apiVersion) {
      errors.push('TrainedModel: Missing required field: apiVersion');
    }
    if (!resource.metadata) {
      errors.push('TrainedModel: Missing required field: metadata');
    } else if (!resource.metadata.name) {
      errors.push('TrainedModel: Missing required field: metadata.name');
    }
    if (!resource.spec) {
      errors.push('TrainedModel: Missing required field: spec');
    } else {
      if (!resource.spec.inferenceService) {
        errors.push(
          'TrainedModel: Missing required field: spec.inferenceService',
        );
      }
      if (!resource.spec.model) {
        errors.push('TrainedModel: Missing required field: spec.model');
      }
    }
    return errors;
  }

  private showError(msg: string, duration = 8000) {
    const config: SnackBarConfig = {
      data: { msg, snackType: SnackType.Error },
      duration,
    };
    this.snack.open(config);
  }

  private showSuccess(msg: string) {
    const config: SnackBarConfig = {
      data: { msg, snackType: SnackType.Success },
      duration: 3000,
    };
    this.snack.open(config);
  }
}
