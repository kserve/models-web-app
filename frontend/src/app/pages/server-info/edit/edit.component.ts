import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { dump, load } from 'js-yaml';
import { SnackBarService, SnackType } from 'kubeflow';
import { InferenceServiceK8s } from '../../../types/kfserving/v1beta1';
import { MWABackendService } from '../../../services/backend.service';
import * as ace from 'ace-builds';
import { Ace } from 'ace-builds';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-xcode';
import 'ace-builds/src-noconflict/ext-language_tools';

@Component({
  selector: 'app-edit',
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss'],
})
export class EditComponent implements OnInit, AfterViewInit, OnDestroy {
  // Implement AfterViewInit, OnDestroy
  @Input() inferenceService: InferenceServiceK8s;
  @Output() cancelEdit = new EventEmitter<boolean>();

  @ViewChild('editorWrapper') editorWrapper: ElementRef;
  private aceEditorInstance: Ace.Editor;

  private originalName: string;
  private originalNamespace: string;
  private resourceVersion: string;

  isDebug = false;
  data = '';
  applying = false;

  editorStyle = {
    width: '100%',
    height: '600px',
    fontSize: '14px',
  };

  constructor(
    private snack: SnackBarService,
    private backend: MWABackendService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    console.log('[Debug] EditComponent ngOnInit started.');

    this.originalName = this.inferenceService.metadata.name;
    this.originalNamespace = this.inferenceService.metadata.namespace;
    this.resourceVersion = this.inferenceService.metadata.resourceVersion;

    const inferenceServiceToDump = JSON.parse(JSON.stringify(this.inferenceService));
    delete inferenceServiceToDump.metadata.name;
    delete inferenceServiceToDump.metadata.namespace;
    delete inferenceServiceToDump.metadata.creationTimestamp;
    delete inferenceServiceToDump.metadata.finalizers;
    delete inferenceServiceToDump.metadata.generation;
    delete inferenceServiceToDump.metadata.managedFields;
    delete inferenceServiceToDump.metadata.resourceVersion;
    delete inferenceServiceToDump.metadata.selfLink;
    delete inferenceServiceToDump.metadata.uid;
    if (
      inferenceServiceToDump.metadata.annotations &&
      'kubectl.kubernetes.io/last-applied-configuration' in
        inferenceServiceToDump.metadata.annotations
    ) {
      delete inferenceServiceToDump.metadata.annotations[
        'kubectl.kubernetes.io/last-applied-configuration'
      ];
    }
    delete inferenceServiceToDump.status;

    try {
      this.data = dump(inferenceServiceToDump);
      console.log(
        '[Debug] Initial YAML data prepared:',
        this.data.substring(0, 100) + '...',
      );
    } catch (e) {
      console.error('Error dumping initial YAML:', e);
      this.data = '# Error loading initial YAML';
    }

    console.log('[Debug] EditComponent ngOnInit completed.');
  }

  ngAfterViewInit(): void {
    console.log('[Debug] EditComponent ngAfterViewInit called.');
    if (!this.editorWrapper || !this.editorWrapper.nativeElement) {
      console.error(
        '[Debug] Editor wrapper element not found in ngAfterViewInit.',
      );
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      console.log('[Debug] Initializing ACE editor manually.');
      try {
        this.aceEditorInstance = ace.edit(this.editorWrapper.nativeElement, {
          mode: 'ace/mode/yaml',
          theme: 'ace/theme/xcode',
          value: this.data,
          readOnly: false,
          tabSize: 2,
          showPrintMargin: false,
          fontSize: 14,
          minLines: 20,
          maxLines: Infinity,
          enableBasicAutocompletion: true,
          enableSnippets: true,
          enableLiveAutocompletion: true,
        });

        console.log(
          '[Debug] Manual ACE editor instance created:',
          this.aceEditorInstance,
        );

        const session = this.aceEditorInstance.getSession();
        session.setUseWorker(false);

        this.aceEditorInstance.on('change', () => {
          this.ngZone.run(() => {
            this.data = this.aceEditorInstance.getValue();
          });
        });

        this.aceEditorInstance.focus();
        this.aceEditorInstance.moveCursorTo(0, 0);
      } catch (error) {
        console.error(
          '[Debug] Manual ACE editor initialization failed:',
          error,
        );
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up the editor instance when the component is destroyed
    if (this.aceEditorInstance) {
      console.log('[Debug] Destroying manual ACE editor instance.');
      this.aceEditorInstance.destroy();
      this.aceEditorInstance = null;
    }
  }

  submit() {
    console.log('Submit called');
    this.applying = true;

    let cr: InferenceServiceK8s = {};
    try {
      cr = load(this.data);
      console.log('YAML parsed successfully');
    } catch (e) {
      this.applying = false;
      return;
    }

    cr.metadata.resourceVersion = this.resourceVersion;
    cr.metadata.name = this.originalName;
    cr.metadata.namespace = this.originalNamespace;

    console.log('Sending InferenceService update request');
    this.backend
      .editInferenceService(this.originalNamespace, this.originalName, cr)
      .subscribe({
        next: () => {
          console.log('InferenceService updated successfully');
          this.snack.open({
            data: {
              msg: 'InferenceService successfully updated',
              snackType: SnackType.Success,
            },
          });
          this.cancelEdit.emit(true);
        },
        error: err => {
          console.error('Error updating InferenceService:', err);
          this.applying = false;
          this.snack.open({
            data: {
              msg: `Failed to update InferenceService: ${
                err.message || 'Unknown error'
              }`,
              snackType: SnackType.Error,
            },
          });
        },
      });
  }
}
