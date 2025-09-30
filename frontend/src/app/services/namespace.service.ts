import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { MWABackendService } from './backend.service';

@Injectable({
  providedIn: 'root',
})
export class MWANamespaceService {
  private singleNamespaceMode$ = new BehaviorSubject<boolean>(false);
  private allowedNamespacesSubject$ = new BehaviorSubject<string[]>([]);
  
  constructor(private backend: MWABackendService) {}

  /**
   * Get the filtered namespaces based on ALLOWED_NAMESPACES environment variable
   */
  public getFilteredNamespaces(): Observable<string[]> {
    return this.backend.http.get<any>('/api/namespaces').pipe(
      map(response => response.namespaces || []),
      tap((namespaces: string[]) => {
        this.allowedNamespacesSubject$.next(namespaces);
        // If only one namespace is available, we're in single namespace mode
        this.singleNamespaceMode$.next(namespaces.length === 1);
      })
    );
  }

  /**
   * Check if we're in single namespace mode (should hide the dropdown)
   */
  public get isSingleNamespaceMode$(): Observable<boolean> {
    return this.singleNamespaceMode$.asObservable();
  }

  /**
   * Get the current allowed namespaces
   */
  public get allowedNamespaces$(): Observable<string[]> {
    return this.allowedNamespacesSubject$.asObservable();
  }

  /**
   * Get the single namespace when in single namespace mode
   */
  public getSingleNamespace(): string | null {
    const namespaces = this.allowedNamespacesSubject$.value;
    return namespaces.length === 1 ? namespaces[0] : null;
  }
}