import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  NamespaceService,
  DashboardState,
  K8sObject,
  SnackBarConfig,
  SnackBarService,
  SnackType,
} from 'kubeflow';
import { loadAll } from 'js-yaml';
import { Subscription } from 'rxjs';
import { MWABackendService } from 'src/app/services/backend.service';
import { MWANamespaceService } from 'src/app/services/mwa-namespace.service';

const SUPPORTED_KSERVE_RESOURCES = new Set([
  'serving.kserve.io/v1beta1|InferenceService',
  'serving.kserve.io/v1alpha1|InferenceGraph',
  'serving.kserve.io/v1alpha1|TrainedModel',
]);

const SUPPORTED_KSERVE_RESOURCE_LABELS = [
  'serving.kserve.io/v1beta1 InferenceService',
  'serving.kserve.io/v1alpha1 InferenceGraph',
  'serving.kserve.io/v1alpha1 TrainedModel',
].join(', ');

@Component({
  selector: 'app-submit-form',
  templateUrl: './submit-form.component.html',
  styleUrls: ['./submit-form.component.scss'],
})
export class SubmitFormComponent implements OnInit, OnDestroy {
  yaml = '';
  namespace!: string;
  applying = false;

  private namespaceSubscription = new Subscription();
  private dashboardSubscription = new Subscription();

  constructor(
    private router: Router,
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
  }

  ngOnDestroy() {
    this.namespaceSubscription.unsubscribe();
    this.dashboardSubscription.unsubscribe();
  }

  navigateBack() {
    this.router.navigate(['']);
  }

  submit() {
    this.applying = true;

    if (!this.namespace) {
      this.showError('No namespace selected.');
      this.applying = false;
      return;
    }

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

    const validDocs = docs.filter(doc => doc != null);
    if (validDocs.length === 0) {
      this.showError('YAML is empty or invalid');
      this.applying = false;
      return;
    }

    const validationErrors: string[] = [];
    const resources: K8sObject[] = [];

    validDocs.forEach((doc, index) => {
      const documentIndex = index + 1;
      if (!this.isResourceObject(doc)) {
        validationErrors.push(
          `Document ${documentIndex}: resource must be an object`,
        );
      } else {
        const resource = doc as K8sObject;
        validationErrors.push(
          ...this.validateResource(resource, documentIndex),
        );
        resources.push(resource);
      }
    });

    if (validationErrors.length > 0) {
      this.showError(validationErrors.join(' | '), 16000);
      this.applying = false;
      return;
    }

    resources.forEach(resource => this.setResourceNamespace(resource));

    this.backend.postKServeResources(this.namespace, resources).subscribe({
      next: response => {
        const total = response.createdResources?.length ?? resources.length;
        const msg =
          total === 1
            ? '1 KServe resource created successfully.'
            : `${total} KServe resources created successfully.`;
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

  private isResourceObject(doc: unknown): doc is K8sObject {
    return typeof doc === 'object' && doc !== null && !Array.isArray(doc);
  }

  private validateResource(
    resource: K8sObject,
    documentIndex: number,
  ): string[] {
    const errors: string[] = [];
    const customResource = resource as any;
    const apiVersion = customResource.apiVersion;
    const kind = customResource.kind;
    const metadata = customResource.metadata;

    if (!apiVersion) {
      errors.push(
        `Document ${documentIndex}: missing required field apiVersion`,
      );
    }
    if (!kind) {
      errors.push(`Document ${documentIndex}: missing required field kind`);
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      errors.push(`Document ${documentIndex}: missing required field metadata`);
    } else if (!metadata.name) {
      errors.push(
        `Document ${documentIndex}: missing required field metadata.name`,
      );
    }
    if (customResource.spec == null) {
      errors.push(`Document ${documentIndex}: missing required field spec`);
    }

    if (
      apiVersion &&
      kind &&
      !SUPPORTED_KSERVE_RESOURCES.has(`${apiVersion}|${kind}`)
    ) {
      errors.push(
        `Document ${documentIndex}: unsupported resource ${apiVersion} ${kind}. ` +
          `Supported resources: ${SUPPORTED_KSERVE_RESOURCE_LABELS}`,
      );
    }
    return errors;
  }

  private setResourceNamespace(resource: K8sObject) {
    const customResource = resource as any;
    customResource.metadata.namespace = this.namespace;
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
