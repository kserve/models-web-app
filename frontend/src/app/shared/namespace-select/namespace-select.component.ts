import { Component, OnInit, OnDestroy } from '@angular/core';
import { NamespaceService } from 'kubeflow';
import { Subscription, Observable } from 'rxjs';
import { MWANamespaceService } from '../../services/namespace.service';

@Component({
  selector: 'app-namespace-select',
  template: `
    <lib-namespace-select 
      *ngIf="!(isSingleNamespaceMode$ | async)">
    </lib-namespace-select>
  `,
})
export class NamespaceSelectComponent implements OnInit, OnDestroy {
  public isSingleNamespaceMode$: Observable<boolean>;
  private subscription = new Subscription();

  constructor(
    private ns: NamespaceService,
    private mwaNs: MWANamespaceService
  ) {
    this.isSingleNamespaceMode$ = this.mwaNs.isSingleNamespaceMode$;
  }

  ngOnInit(): void {
    this.subscription.add(
      this.mwaNs.getFilteredNamespaces().subscribe((namespaces) => {
        if (namespaces.length === 1) {
          this.ns.updateSelectedNamespace(namespaces[0]);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}