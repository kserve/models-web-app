import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { dump, load } from 'js-yaml';
import { SnackBarService, SnackType } from 'kubeflow';
import { InferenceServiceK8s } from '../../../types/kfserving/v1beta1';
import { MWABackendService } from '../../../services/backend.service';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditComponent implements OnInit {
  @Input() isvc: InferenceServiceK8s;
  @Output() cancelEdit = new EventEmitter<boolean>();

  private originalName: string;
  private originalNamespace: string;
  private resourceVersion: string;

  data = '';
  applying = false;

  constructor(
    private snack: SnackBarService,
    private backend: MWABackendService,
  ) {}

  ngOnInit() {
    this.originalName = this.isvc.metadata.name;
    this.originalNamespace =  this.isvc.metadata.namespace;
    this.resourceVersion = this.isvc.metadata.resourceVersion;

    delete this.isvc.metadata.name;
    delete this.isvc.metadata.namespace;
    delete this.isvc.metadata.creationTimestamp;
    delete this.isvc.metadata.finalizers;
    delete this.isvc.metadata.generation;
    delete this.isvc.metadata.managedFields;
    delete this.isvc.metadata.resourceVersion;
    delete this.isvc.metadata.selfLink;
    if ('annotations' in this.isvc.metadata && 'kubectl.kubernetes.io/last-applied-configuration' in this.isvc.metadata.annotations) {
      delete this.isvc.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
    }
    delete this.isvc.metadata.uid;
    delete this.isvc.status;

    this.data = dump(this.isvc);
  }

  submit() {
    this.applying = true;

    let cr: InferenceServiceK8s = {};
    try {
      cr = load(this.data);
    } catch (e) {
      let msg = 'Could not parse the provided YAML';

      if (e.mark && e.mark.line) {
        msg = 'Error parsing the provided YAML in line: ' + e.mark.line;
      }

      this.snack.open(msg, SnackType.Error, 16000);
      this.applying = false;
      return;
    }

    const requiredFields = ['apiVersion', 'kind', 'metadata', 'spec'];
    for (const field of requiredFields) {
      if (!cr[field]) {
        this.snack.open(
          'InferenceService must have a metadata field.',
          SnackType.Error,
          8000,
        );

        this.applying = false;
        return;
      }
    }

    const prohibitedFields = ['name', 'namespace'];
    for (const field of prohibitedFields) {
      if (cr.metadata[field]) {
        this.snack.open(
          `You cannot set the metadata.${field} field`,
          SnackType.Error,
          8000,
        );

        this.applying = false;
        return;
      }
    }

    // Updating a resource requires passing in the resource's current resourceVersion
    // so add this back to the cr before sending it off
    cr.metadata.resourceVersion = this.resourceVersion;
    cr.metadata.name = this.originalName;
    cr.metadata.namespace = this.originalNamespace;

    this.backend.editInferenceService(
      this.originalNamespace,
      this.originalName,
      cr)
    .subscribe({
      next: () => {
        this.snack.open(
          'InferenceService successfully updated',
          SnackType.Success,
          8000,
        );
        this.cancelEdit.emit(true);
      },
      error: () => {
        this.applying = false;
      },
    });
  }
}
