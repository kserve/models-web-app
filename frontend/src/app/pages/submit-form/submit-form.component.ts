import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  NamespaceService,
  DashboardState,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { InferenceServiceK8s } from 'src/app/types/kfserving/v1beta1';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';
import { Subscription } from 'rxjs';
import { load, dump } from 'js-yaml';

@Component({
  selector: 'app-submit-form',
  templateUrl: './submit-form.component.html',
  styleUrls: ['./submit-form.component.scss'],
})
export class SubmitFormComponent implements OnInit, OnDestroy {
  namespace!: string;
  applying = false;
  deployForm: FormGroup;

  /** When true the structured form is hidden and a YAML editor is shown. */
  yamlMode = false;
  yamlText = '';

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

  private namespaceSubscription = new Subscription();
  private dashboardSubscription = new Subscription();

  constructor(
    private router: Router,
    private namespaceService: NamespaceService,
    private mwaNamespace: MWANamespaceService,
    private snack: SnackBarService,
    private backend: MWABackendService,
    private fb: FormBuilder,
  ) {
    this.deployForm = this.fb.group({
      modelName: [
        '',
        [
          Validators.required,
          Validators.pattern('^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$'),
        ],
      ],
      modelFramework: ['', Validators.required],
      frameworkVersion: [''],
      storageUri: [
        '',
        [Validators.required, Validators.pattern('^(gs|s3|https?|pvc)://.*')],
      ],
      runtime: [''],
      minReplicas: [1, [Validators.min(0), Validators.max(100)]],
      maxReplicas: [1, [Validators.min(1), Validators.max(100)]],
      gpuCount: [0, [Validators.min(0), Validators.max(16)]],
      cpuRequest: [''],
      cpuLimit: [''],
      memoryRequest: [''],
      memoryLimit: [''],
    });
  }

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
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.dashboardSubscription.unsubscribe();
  }

  navigateBack() {
    this.router.navigate(['']);
  }

  /** Toggle between structured form and YAML editor. */
  toggleYamlMode(checked: boolean) {
    this.yamlMode = checked;
    if (checked && !this.yamlText) {
      // Provide a starter template
      this.yamlText = dump(
        {
          apiVersion: 'serving.kserve.io/v1beta1',
          kind: 'InferenceService',
          metadata: {
            name: 'my-model',
          },
          spec: {
            predictor: {
              model: {
                modelFormat: { name: 'sklearn' },
                storageUri: 'gs://bucket/path',
              },
            },
          },
        },
        { lineWidth: -1 },
      );
    }
  }

  /** Whether the create button should be disabled. */
  get createDisabled(): boolean {
    if (this.yamlMode) {
      return !this.yamlText.trim();
    }
    return this.deployForm.invalid;
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

    // Set namespace from the dashboard selector
    parsed.metadata.namespace = this.namespace;

    this.backend.postInferenceService(parsed).subscribe({
      next: () => {
        this.snack.open({
          data: {
            msg: $localize`InferenceService created successfully.`,
            snackType: SnackType.Success,
          },
          duration: 3000,
        });
        this.applying = false;
        this.navigateBack();
      },
      error: err => {
        this.handleError(err, $localize`Failed to create InferenceService`);
      },
    });
  }

  private submitForm() {
    if (this.deployForm.invalid) {
      this.deployForm.markAllAsTouched();
      return;
    }

    this.applying = true;
    const v = this.deployForm.value;

    if (v.minReplicas > v.maxReplicas) {
      const config: SnackBarConfig = {
        data: {
          msg: $localize`Min replicas (${v.minReplicas}) cannot exceed max replicas (${v.maxReplicas})`,
          snackType: SnackType.Error,
        },
        duration: 8000,
      };
      this.snack.open(config);
      this.applying = false;
      return;
    }

    const customResource = {
      apiVersion: 'serving.kserve.io/v1beta1',
      kind: 'InferenceService',
      metadata: {
        name: v.modelName,
        namespace: this.namespace,
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
    } as InferenceServiceK8s;

    if (v.frameworkVersion) {
      customResource.spec!.predictor.model!.modelFormat.version = String(
        v.frameworkVersion,
      );
    }
    if (v.runtime) {
      customResource.spec!.predictor.model!.runtime = v.runtime;
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
      (customResource.spec!.predictor.model as any).resources = resources;
    }

    this.backend.postInferenceService(customResource).subscribe({
      next: () => {
        this.snack.open({
          data: {
            msg: $localize`InferenceService created successfully.`,
            snackType: SnackType.Success,
          },
          duration: 3000,
        });
        this.applying = false;
        this.navigateBack();
      },
      error: err => {
        this.handleError(err, $localize`Failed to create InferenceService`);
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
    } else if (err?.statusText) {
      errorMsg = $localize`Server error: ${err.statusText}`;
    }

    this.snack.open({
      data: {
        msg: errorMsg,
        snackType: SnackType.Error,
      },
      duration: 16000,
    });
    this.applying = false;
  }
}
