import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  MWANamespaceService,
  MWANamespaceConfig,
} from '../../services/mwa-namespace.service';

@Component({
  selector: 'app-namespace-select',
  templateUrl: './namespace-select.component.html',
  styleUrls: ['./namespace-select.component.scss'],
})
export class NamespaceSelectComponent implements OnInit, OnDestroy {
  public namespaceConfig$: Observable<MWANamespaceConfig | null>;
  public selectedNamespace$: Observable<string>;
  public shouldHideSelector$: Observable<boolean>;
  public selectableNamespaces$: Observable<string[]>;

  private configSubscription?: Subscription;

  constructor(private mwaNamespaceService: MWANamespaceService) {
    this.namespaceConfig$ = this.mwaNamespaceService.getNamespaceConfig$();
    this.selectedNamespace$ = this.mwaNamespaceService.getSelectedNamespace();
    this.shouldHideSelector$ =
      this.mwaNamespaceService.shouldHideNamespaceSelector();
    this.selectableNamespaces$ =
      this.mwaNamespaceService.getSelectableNamespaces();
  }

  ngOnInit(): void {
    // Initialize the namespace service and fetch configuration
    this.configSubscription = this.mwaNamespaceService.initialize().subscribe();
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  /**
   * Handle namespace selection change
   */
  public onNamespaceChange(selectedNamespace: string): void {
    this.mwaNamespaceService.setSelectedNamespace(selectedNamespace);
  }

  /**
   * Track by function for namespace options
   */
  public trackByNamespace(index: number, namespace: string): string {
    return namespace;
  }
}
