import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SnackBarService, SnackType } from 'kubeflow';
import { InferenceServiceK8s } from '../../../types/kfserving/v1beta1';
import { MWABackendService } from '../../../services/backend.service';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditComponent implements OnInit {
  @Input() inferenceService: InferenceServiceK8s;
  @Output() cancelEdit = new EventEmitter<boolean>();

  editForm: FormGroup;
  applying = false;

  private originalName: string;
  private originalNamespace: string;
  private resourceVersion: string;
  private preservedMetadata: any;

  frameworks = [
    { value: 'sklearn', viewValue: $localize`Scikit-learn` },
    { value: 'xgboost', viewValue: $localize`XGBoost` },
    { value: 'tensorflow', viewValue: $localize`TensorFlow` },
    { value: 'pytorch', viewValue: $localize`PyTorch` },
    { value: 'triton', viewValue: $localize`Triton` },
    { value: 'onnx', viewValue: $localize`ONNX` },
    { value: 'pmml', viewValue: $localize`PMML` },
    { value: 'lightgbm', viewValue: $localize`LightGBM` },
    { value: 'paddle', viewValue: $localize`PaddlePaddle` },
    { value: 'huggingface', viewValue: $localize`HuggingFace` },
  ];

  constructor(
    private snack: SnackBarService,
    private backend: MWABackendService,
    private fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.originalName = this.inferenceService.metadata.name;
    this.originalNamespace = this.inferenceService.metadata.namespace;
    this.resourceVersion = this.inferenceService.metadata.resourceVersion;

    // Preserve the full metadata so we don't lose annotations, labels, etc.
    this.preservedMetadata = JSON.parse(
      JSON.stringify(this.inferenceService.metadata),
    );

    const info = this.extractPredictorInfo();

    this.editForm = this.fb.group({
      modelName: [{ value: this.originalName, disabled: true }],
      modelFramework: [info.framework, Validators.required],
      frameworkVersion: [info.frameworkVersion || ''],
      storageUri: [
        info.storageUri || '',
        [Validators.required, Validators.pattern('^(gs|s3|https?|pvc)://.*')],
      ],
      runtime: [info.runtime || ''],
      minReplicas: [
        info.minReplicas ?? 1,
        [Validators.min(0), Validators.max(100)],
      ],
      maxReplicas: [
        info.maxReplicas ?? 1,
        [Validators.min(1), Validators.max(100)],
      ],
      gpuCount: [info.gpuCount ?? 0, [Validators.min(0), Validators.max(16)]],
      cpuRequest: [info.cpuRequest || ''],
      cpuLimit: [info.cpuLimit || ''],
      memoryRequest: [info.memoryRequest || ''],
      memoryLimit: [info.memoryLimit || ''],
    });
  }

  /**
   * Extract predictor information from InferenceServiceK8s.
   * Handles both legacy style (spec.predictor.sklearn, etc.)
   * and the newer model spec style (spec.predictor.model.modelFormat).
   */
  private extractPredictorInfo(): {
    framework: string;
    frameworkVersion: string;
    storageUri: string;
    runtime: string;
    minReplicas: number;
    maxReplicas: number;
    gpuCount: number;
    cpuRequest: string;
    cpuLimit: string;
    memoryRequest: string;
    memoryLimit: string;
  } {
    const predictor = this.inferenceService.spec?.predictor;
    if (!predictor) {
      return {
        framework: '',
        frameworkVersion: '',
        storageUri: '',
        runtime: '',
        minReplicas: 1,
        maxReplicas: 1,
        gpuCount: 0,
        cpuRequest: '',
        cpuLimit: '',
        memoryRequest: '',
        memoryLimit: '',
      };
    }

    let framework = '';
    let frameworkVersion = '';
    let storageUri = '';
    let runtime = '';
    let resources: any = {};

    // New-style: spec.predictor.model.modelFormat
    if (predictor.model?.modelFormat) {
      framework = predictor.model.modelFormat.name || '';
      frameworkVersion = predictor.model.modelFormat.version || '';
      storageUri = predictor.model.storageUri || '';
      runtime = predictor.model.runtime || '';
      resources = (predictor.model as any).resources || {};
    } else {
      // Legacy style: spec.predictor.<framework>
      const legacyTypes = [
        'sklearn',
        'xgboost',
        'tensorflow',
        'pytorch',
        'triton',
        'onnx',
        'pmml',
        'lightgbm',
        'paddle',
        'huggingface',
      ];
      for (const type of legacyTypes) {
        if (predictor[type]) {
          framework = type;
          storageUri = predictor[type].storageUri || '';
          frameworkVersion = predictor[type].runtimeVersion || '';
          resources = predictor[type].resources || {};
          break;
        }
      }
    }

    // Extract resource fields
    const requests = resources.requests || {};
    const limits = resources.limits || {};

    let gpuCount = 0;
    if (limits['nvidia.com/gpu']) {
      gpuCount = parseInt(limits['nvidia.com/gpu'], 10) || 0;
    }

    return {
      framework,
      frameworkVersion,
      storageUri,
      runtime,
      minReplicas: predictor.minReplicas ?? 1,
      maxReplicas: predictor.maxReplicas ?? 1,
      gpuCount,
      cpuRequest: requests.cpu || '',
      cpuLimit: limits.cpu || '',
      memoryRequest: requests.memory || '',
      memoryLimit: limits.memory || '',
    };
  }

  submit() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.applying = true;
    const v = this.editForm.getRawValue(); // getRawValue includes disabled fields

    if (v.minReplicas > v.maxReplicas) {
      this.snack.open({
        data: {
          msg: $localize`Min replicas (${v.minReplicas}) cannot exceed max replicas (${v.maxReplicas})`,
          snackType: SnackType.Error,
        },
        duration: 8000,
      });
      this.applying = false;
      return;
    }

    const cr: any = {
      apiVersion: 'serving.kserve.io/v1beta1',
      kind: 'InferenceService',
      metadata: {
        ...this.preservedMetadata,
        name: this.originalName,
        namespace: this.originalNamespace,
        resourceVersion: this.resourceVersion,
      },
      spec: {
        predictor: {
          minReplicas: v.minReplicas,
          maxReplicas: v.maxReplicas,
          model: {
            modelFormat: {
              name: v.modelFramework,
            },
            storageUri: v.storageUri,
          },
        },
      },
    };

    // Strip Kubernetes-managed metadata fields that shouldn't be sent
    delete cr.metadata.creationTimestamp;
    delete cr.metadata.finalizers;
    delete cr.metadata.generation;
    delete cr.metadata.managedFields;
    delete cr.metadata.selfLink;
    delete cr.metadata.uid;
    if (cr.metadata.annotations) {
      delete cr.metadata.annotations[
        'kubectl.kubernetes.io/last-applied-configuration'
      ];
    }

    if (v.frameworkVersion) {
      cr.spec.predictor.model.modelFormat.version = String(v.frameworkVersion);
    }
    if (v.runtime) {
      cr.spec.predictor.model.runtime = v.runtime;
    }

    const resources: any = {};
    const requests: any = {};
    const limits: any = {};

    if (v.cpuRequest) requests.cpu = v.cpuRequest;
    if (v.memoryRequest) requests.memory = v.memoryRequest;
    if (v.cpuLimit) limits.cpu = v.cpuLimit;
    if (v.memoryLimit) limits.memory = v.memoryLimit;
    if (v.gpuCount > 0) limits['nvidia.com/gpu'] = String(v.gpuCount);

    if (Object.keys(requests).length > 0) resources.requests = requests;
    if (Object.keys(limits).length > 0) resources.limits = limits;
    if (Object.keys(resources).length > 0) {
      cr.spec.predictor.model.resources = resources;
    }

    this.backend
      .editInferenceService(this.originalNamespace, this.originalName, cr)
      .subscribe({
        next: () => {
          this.snack.open({
            data: {
              msg: $localize`InferenceService successfully updated`,
              snackType: SnackType.Success,
            },
          });
          this.cancelEdit.emit(true);
        },
        error: err => {
          this.applying = false;
          let errorMsg = $localize`Failed to update InferenceService`;
          if (err?.error?.log) {
            errorMsg = err.error.log;
          } else if (err?.error?.message) {
            errorMsg = err.error.message;
          } else if (err?.error?.error) {
            errorMsg = err.error.error;
          } else if (typeof err?.error === 'string') {
            errorMsg = err.error;
          } else if (err?.message) {
            errorMsg = $localize`Failed to update InferenceService: ${err.message}`;
          }
          this.snack.open({
            data: {
              msg: errorMsg,
              snackType: SnackType.Error,
            },
            duration: 16000,
          });
        },
      });
  }
}
