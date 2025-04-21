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
// import { AceConfigInterface } from "ngx-ace-wrapper";

import * as ace from 'ace-builds';
import { Ace } from 'ace-builds';

// Import required ACE modes and extensions
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
  @Input() isvc: InferenceServiceK8s;
  @Output() cancelEdit = new EventEmitter<boolean>();

  // Get the div element that will host the editor
  @ViewChild('editorWrapper') editorWrapper: ElementRef;
  private aceEditorInstance: Ace.Editor; // Store the editor instance

  private originalName: string;
  private originalNamespace: string;
  private resourceVersion: string;

  isDebug = false;
  data = '';
  applying = false;

  // Keep editorStyle for applying styles to the host div
  editorStyle = {
    width: '100%',
    height: '600px', // Adjust as needed
    fontSize: '14px',
  };

  constructor(
    private snack: SnackBarService,
    private backend: MWABackendService,
    private ngZone: NgZone, // Inject NgZone
  ) {}

  ngOnInit() {
    console.log('[Debug] EditComponent ngOnInit started.');
    // Prepare initial data for the editor
    // (Keep the logic to prepare this.isvc and dump it to this.data)
    this.originalName = this.isvc.metadata.name;
    this.originalNamespace = this.isvc.metadata.namespace;
    this.resourceVersion = this.isvc.metadata.resourceVersion;

    // Clean up metadata before dumping to YAML
    const isvcToDump = JSON.parse(JSON.stringify(this.isvc)); // Deep copy
    delete isvcToDump.metadata.name;
    delete isvcToDump.metadata.namespace;
    delete isvcToDump.metadata.creationTimestamp;
    delete isvcToDump.metadata.finalizers;
    delete isvcToDump.metadata.generation;
    delete isvcToDump.metadata.managedFields;
    delete isvcToDump.metadata.resourceVersion;
    delete isvcToDump.metadata.selfLink;
    delete isvcToDump.metadata.uid;
    if (
      isvcToDump.metadata.annotations &&
      'kubectl.kubernetes.io/last-applied-configuration' in
        isvcToDump.metadata.annotations
    ) {
      delete isvcToDump.metadata.annotations[
        'kubectl.kubernetes.io/last-applied-configuration'
      ];
    }
    delete isvcToDump.status;

    try {
      this.data = dump(isvcToDump);
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

    // Initialize ACE outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      console.log('[Debug] Initializing ACE editor manually.');
      try {
        this.aceEditorInstance = ace.edit(this.editorWrapper.nativeElement, {
          mode: 'ace/mode/yaml',
          theme: 'ace/theme/xcode',
          value: this.data, // Set initial value from ngOnInit
          readOnly: false,
          tabSize: 2,
          showPrintMargin: false,
          fontSize: 14,
          minLines: 20,
          maxLines: Infinity, // Or use a number based on editorStyle height
          enableBasicAutocompletion: true,
          enableSnippets: true,
          enableLiveAutocompletion: true,
        });

        console.log(
          '[Debug] Manual ACE editor instance created:',
          this.aceEditorInstance,
        );

        // --- Add this section to disable the worker ---
        const session = this.aceEditorInstance.getSession();
        session.setUseWorker(false); // Disable background syntax checking
        console.log('[Debug] ACE worker disabled for the session.');
        // --- End section ---

        // Listen for changes and update this.data inside Angular zone
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

  // This method is no longer needed as we removed the (init) binding
  // onAceInit(event: any): void { ... }

  submit() {
    console.log('Submit called');
    this.applying = true;

    // Ensure data is synced if needed (should be handled by 'change' listener now)
    // if (this.aceEditorInstance) {
    //   this.data = this.aceEditorInstance.getValue();
    // }

    let cr: InferenceServiceK8s = {};
    try {
      cr = load(this.data); // Use the component's data property
      console.log('YAML parsed successfully');
    } catch (e) {
      // ... (existing error handling) ...
      this.applying = false;
      return;
    }

    // ... (existing validation logic) ...

    // Add back necessary metadata before sending
    cr.metadata.resourceVersion = this.resourceVersion;
    cr.metadata.name = this.originalName;
    cr.metadata.namespace = this.originalNamespace;

    console.log('Sending InferenceService update request');
    this.backend
      .editInferenceService(this.originalNamespace, this.originalName, cr)
      .subscribe({
        // ... (existing success/error handling) ...
        next: () => {
          console.log('InferenceService updated successfully');
          this.snack.open({
            data: {
              msg: 'InferenceService successfully updated',
              snackType: SnackType.Success,
            },
          });
          this.cancelEdit.emit(true); // Close the edit view
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
