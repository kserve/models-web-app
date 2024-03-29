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

    let cr: InferenceServiceK8s = {};
    try {
      cr = load(this.yaml);
    } catch (e) {
      let msg = 'Could not parse the provided YAML';

      if (e.mark && e.mark.line) {
        msg = 'Error parsing the provided YAML in line: ' + e.mark.line;
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

    if (!cr.metadata) {
      const config: SnackBarConfig = {
        data: {
          msg: 'InferenceService must have a metadata field.',
          snackType: SnackType.Error,
        },
        duration: 8000,
      };
      this.snack.open(config);

      this.applying = false;
      return;
    }

    cr.metadata.namespace = this.namespace;
    console.log(cr);

    this.backend.postInferenceService(cr).subscribe({
      next: () => {
        this.navigateBack();
      },
      error: () => {
        this.applying = false;
      },
    });
  }
}
