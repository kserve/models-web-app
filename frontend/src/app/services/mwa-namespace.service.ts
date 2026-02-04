import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { SnackBarService, SnackBarConfig, SnackType } from 'kubeflow';

export interface MWANamespaceConfig {
  namespaces: string[];
  allowedNamespaces: string[];
  isSingleNamespace: boolean;
  autoSelectedNamespace?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MWANamespaceService {
  private _namespaceConfig$ = new BehaviorSubject<MWANamespaceConfig | null>(
    null,
  );
  private _selectedNamespace$ = new BehaviorSubject<string>('');
  private _isInitialized = false;

  constructor(private http: HttpClient, private snack: SnackBarService) {}

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<any> {
    console.error('HTTP Error:', error);
    const config: SnackBarConfig = {
      data: {
        msg: 'Error fetching namespace configuration',
        snackType: SnackType.Error,
      },
      duration: 5000,
    };
    this.snack.open(config);
    return of(null);
  }

  /**
   * Get the namespace configuration from the backend
   */
  public getNamespaceConfig(): Observable<MWANamespaceConfig> {
    if (this._namespaceConfig$.value && this._isInitialized) {
      return this._namespaceConfig$.asObservable();
    }

    return this.http
      .get<{ namespaces: string[] }>('/api/config/namespaces')
      .pipe(
        catchError(error => {
          console.error('Error fetching namespace config:', error);
          this.handleError(error);
          // Return empty config as fallback
          return of({ namespaces: [] });
        }),
        map(response => {
          const namespaces = response.namespaces || [];
          let autoSelected: string | undefined;
          if (namespaces.length > 0) {
            if (namespaces.includes('default')) {
              autoSelected = 'default';
            } else {
              autoSelected = namespaces[0];
            }
          }
          const config: MWANamespaceConfig = {
            namespaces: namespaces,
            allowedNamespaces: namespaces,
            isSingleNamespace: namespaces.length === 1,
            autoSelectedNamespace: autoSelected,
          };
          return config;
        }),
        tap(config => {
          this._namespaceConfig$.next(config);
          this._isInitialized = true;

          // Auto-select the namespace
          if (config.autoSelectedNamespace) {
            this.setSelectedNamespace(config.autoSelectedNamespace);
          }
        }),
      );
  }

  /**
   * Get the current namespace configuration as an observable
   */
  public getNamespaceConfig$(): Observable<MWANamespaceConfig | null> {
    return this._namespaceConfig$.asObservable();
  }

  /**
   * Get the currently selected namespace
   */
  public getSelectedNamespace(): Observable<string> {
    return this._selectedNamespace$.asObservable();
  }

  /**
   * Set the selected namespace
   */
  public setSelectedNamespace(namespace: string): void {
    this._selectedNamespace$.next(namespace);
  }

  /**
   * Check if the namespace selector should be hidden
   * (true when there's only one allowed namespace)
   */
  public shouldHideNamespaceSelector(): Observable<boolean> {
    return this._namespaceConfig$
      .asObservable()
      .pipe(map(config => config?.isSingleNamespace || false));
  }

  /**
   * Get the list of selectable namespaces
   */
  public getSelectableNamespaces(): Observable<string[]> {
    return this._namespaceConfig$
      .asObservable()
      .pipe(map(config => config?.allowedNamespaces || []));
  }

  /**
   * Initialize the service and return the selected namespace observable
   * This is the main method that components should use
   */
  public initialize(): Observable<string> {
    return this.getNamespaceConfig().pipe(
      tap(config => {
        // Auto-select the namespace if available
        if (config.autoSelectedNamespace) {
          this.setSelectedNamespace(config.autoSelectedNamespace);
        }
      }),
      map(config => {
        // Return the auto-selected namespace or empty string
        return config.autoSelectedNamespace || this._selectedNamespace$.value;
      }),
    );
  }

  /**
   * Reset the service state (useful for testing)
   */
  public reset(): void {
    this._namespaceConfig$.next(null);
    this._selectedNamespace$.next('');
    this._isInitialized = false;
  }
}
