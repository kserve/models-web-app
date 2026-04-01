import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SnackBarService, SnackType } from 'kubeflow';
import {
  InferenceServiceK8s,
  PredictorSpec,
} from '../../../types/kfserving/v1beta1';
import { MWABackendService } from '../../../services/backend.service';
import { dump, load } from 'js-yaml';

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

  /** When true the structured form is hidden and a YAML editor is shown. */
  yamlMode = false;
  yamlText = '';

  private originalName: string;
  private originalNamespace: string;

  /**
   * The legacy predictor key detected on the original InferenceService
   * (e.g. 'sklearn', 'tensorflow'). When present the patch must null it
   * out so the old and new spec shapes don't coexist.
   */
  private originalLegacyKey: string | null = null;

  /** Snapshot of every form value at init time, used to compute the diff. */
  private initialValues: Record<string, any>;

  /**
   * Kubernetes-managed metadata fields that should be stripped when
   * the user submits raw YAML via PUT.
   */
  private static readonly MANAGED_METADATA_FIELDS = [
    'uid',
    'selfLink',
    'creationTimestamp',
    'generation',
    'managedFields',
    'ownerReferences',
    'finalizers',
  ];

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
    { value: 'custom', viewValue: $localize`Custom` },
  ];

  constructor(
    private snack: SnackBarService,
    private backend: MWABackendService,
    private fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.originalName = this.inferenceService.metadata.name;
    this.originalNamespace = this.inferenceService.metadata.namespace;

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

    // Snapshot so we can diff later
    this.initialValues = this.editForm.getRawValue();
  }

  /** Toggle between structured form and YAML editor. */
  toggleYamlMode(checked: boolean) {
    this.yamlMode = checked;
    if (checked) {
      // Pre-populate the editor with the current InferenceService YAML,
      // stripping managed metadata so the user sees a clean document.
      const cleanObj = this.stripManagedMetadata(
        JSON.parse(JSON.stringify(this.inferenceService)),
      );
      this.yamlText = dump(cleanObj, { lineWidth: -1 });
    }
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
      const legacyTypes: (keyof Pick<
        PredictorSpec,
        | 'sklearn'
        | 'xgboost'
        | 'tensorflow'
        | 'pytorch'
        | 'triton'
        | 'onnx'
        | 'pmml'
        | 'lightgbm'
        | 'huggingface'
      >)[] = [
        'sklearn',
        'xgboost',
        'tensorflow',
        'pytorch',
        'triton',
        'onnx',
        'pmml',
        'lightgbm',
        'huggingface',
      ];
      for (const type of legacyTypes) {
        const spec = predictor[type];
        if (spec) {
          framework = type;
          storageUri = spec.storageUri || '';
          frameworkVersion = spec.runtimeVersion || '';
          resources = (spec as any).resources || {};
          this.originalLegacyKey = type;
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

  /**
   * Build a Kubernetes merge-patch document containing only the fields
   * that the user actually changed.
   */
  private buildPatch(): any | null {
    const v = this.editForm.getRawValue();
    const init = this.initialValues;

    const predictor: any = {};
    const model: any = {};
    const modelFormat: any = {};
    const resources: any = {};
    const requests: any = {};
    const limits: any = {};
    let hasModelChanges = false;
    let hasFormatChanges = false;
    let hasResourceChanges = false;
    let hasRequestChanges = false;
    let hasLimitChanges = false;
    let hasPredictorChanges = false;

    // --- Model format ---
    if (v.modelFramework !== init.modelFramework) {
      modelFormat.name = v.modelFramework;
      hasFormatChanges = true;
    }
    if (v.frameworkVersion !== init.frameworkVersion) {
      modelFormat.version = v.frameworkVersion || undefined;
      hasFormatChanges = true;
    }
    if (hasFormatChanges) {
      // Always send both name + version when format changes
      modelFormat.name = v.modelFramework;
      if (v.frameworkVersion) {
        modelFormat.version = String(v.frameworkVersion);
      }
      model.modelFormat = modelFormat;
      hasModelChanges = true;
    }

    // --- Storage URI ---
    if (v.storageUri !== init.storageUri) {
      model.storageUri = v.storageUri;
      hasModelChanges = true;
    }

    // --- Runtime ---
    if (v.runtime !== init.runtime) {
      model.runtime = v.runtime || undefined;
      hasModelChanges = true;
    }

    // --- Resources ---
    if (v.cpuRequest !== init.cpuRequest) {
      requests.cpu = v.cpuRequest || undefined;
      hasRequestChanges = true;
    }
    if (v.memoryRequest !== init.memoryRequest) {
      requests.memory = v.memoryRequest || undefined;
      hasRequestChanges = true;
    }
    if (v.cpuLimit !== init.cpuLimit) {
      limits.cpu = v.cpuLimit || undefined;
      hasLimitChanges = true;
    }
    if (v.memoryLimit !== init.memoryLimit) {
      limits.memory = v.memoryLimit || undefined;
      hasLimitChanges = true;
    }
    if (v.gpuCount !== init.gpuCount) {
      limits['nvidia.com/gpu'] =
        v.gpuCount > 0 ? String(v.gpuCount) : undefined;
      hasLimitChanges = true;
    }

    if (hasRequestChanges) {
      resources.requests = requests;
      hasResourceChanges = true;
    }
    if (hasLimitChanges) {
      resources.limits = limits;
      hasResourceChanges = true;
    }
    if (hasResourceChanges) {
      model.resources = resources;
      hasModelChanges = true;
    }

    if (hasModelChanges) {
      predictor.model = model;
      hasPredictorChanges = true;
    }

    // --- Scaling (lives on predictor, not model) ---
    if (v.minReplicas !== init.minReplicas) {
      predictor.minReplicas = v.minReplicas;
      hasPredictorChanges = true;
    }
    if (v.maxReplicas !== init.maxReplicas) {
      predictor.maxReplicas = v.maxReplicas;
      hasPredictorChanges = true;
    }

    // --- Legacy key cleanup ---
    if (this.originalLegacyKey) {
      predictor[this.originalLegacyKey] = null;
      hasPredictorChanges = true;

      if (!predictor.model) {
        predictor.model = {};
      }
      if (!predictor.model.modelFormat) {
        predictor.model.modelFormat = {
          name: v.modelFramework,
        };
        if (v.frameworkVersion) {
          predictor.model.modelFormat.version = String(v.frameworkVersion);
        }
      }
      if (!predictor.model.storageUri) {
        predictor.model.storageUri = v.storageUri;
      }
    }

    if (!hasPredictorChanges) {
      return null; // Nothing changed
    }

    return {
      spec: {
        predictor,
      },
    };
  }

  /**
   * Strip Kubernetes-managed metadata fields that should not be sent
   * in a PUT request from the YAML editor.
   */
  private stripManagedMetadata(obj: any): any {
    if (obj?.metadata) {
      for (const field of EditComponent.MANAGED_METADATA_FIELDS) {
        delete obj.metadata[field];
      }
    }
    // Also strip status — it's server-managed
    delete obj.status;
    return obj;
  }

  submit() {
    if (this.yamlMode) {
      this.submitYaml();
    } else {
      this.submitForm();
    }
  }

  private submitYaml() {
    this.applying = true;

    let parsed: any;
    try {
      parsed = load(this.yamlText);
    } catch (e: any) {
      this.snack.open({
        data: {
          msg: $localize`Invalid YAML: ${e.message}`,
          snackType: SnackType.Error,
        },
        duration: 8000,
      });
      this.applying = false;
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      this.snack.open({
        data: {
          msg: $localize`YAML must be a valid object`,
          snackType: SnackType.Error,
        },
        duration: 8000,
      });
      this.applying = false;
      return;
    }

    // Ensure required top-level keys
    for (const key of ['apiVersion', 'kind', 'metadata', 'spec']) {
      if (!parsed[key]) {
        this.snack.open({
          data: {
            msg: $localize`Missing required field: ${key}`,
            snackType: SnackType.Error,
          },
          duration: 8000,
        });
        this.applying = false;
        return;
      }
    }

    // Strip managed metadata to avoid conflicts
    this.stripManagedMetadata(parsed);

    // Ensure the namespace and name are correct
    parsed.metadata.namespace = this.originalNamespace;
    parsed.metadata.name = this.originalName;

    // Use PUT (full replacement) for raw YAML submissions
    this.backend
      .editInferenceService(this.originalNamespace, this.originalName, parsed)
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
          this.handleError(err, $localize`Failed to update InferenceService`);
        },
      });
  }

  private submitForm() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.applying = true;
    const v = this.editForm.getRawValue();

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

    const patch = this.buildPatch();

    if (patch === null) {
      this.snack.open({
        data: {
          msg: $localize`No changes detected`,
          snackType: SnackType.Warning,
        },
        duration: 4000,
      });
      this.applying = false;
      return;
    }

    this.backend
      .patchInferenceService(this.originalNamespace, this.originalName, patch)
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
          this.handleError(err, $localize`Failed to update InferenceService`);
        },
      });
  }

  private handleError(err: any, defaultMsg: string) {
    let errorMsg = defaultMsg;
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
  }
}
