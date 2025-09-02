import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, tap, switchAll, concatAll, switchMap } from 'rxjs/operators';
import { BackendService, SnackBarService } from 'kubeflow';
import { ReplaySubject, Observable, of, throwError } from 'rxjs';
import { GrafanaDashboard } from '../types/grafana';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class GrafanaService extends BackendService {
  public orgId = 1;
  public serviceInitializedSuccessfully$ = new ReplaySubject<boolean>(1);

  private dashboardsInitialized = false;
  private dashboards = new ReplaySubject<GrafanaDashboard[]>(1);
  private dashboardUris = new ReplaySubject<{
    [uri: string]: GrafanaDashboard;
  }>(1);
  private grafanaPrefix: string;

  constructor(
    public http: HttpClient, 
    public snack: SnackBarService,
    private configService: ConfigService
  ) {
    super(http, snack);

    console.log('Fetching Grafana dashboards info');
    this.configService.getConfig().subscribe(
      config => {
        this.grafanaPrefix = config.grafanaPrefix;
        this.initializeDashboards();
      },
      error => {
        console.error('Failed to load configuration for GrafanaService:', error);
        // Use default prefix as fallback
        this.grafanaPrefix = '/grafana';
        this.initializeDashboards();
      }
    );
  }

  private initializeDashboards(): void {
    this.getDashboardsInfo().subscribe(
      (dashboards: GrafanaDashboard[]) => {
        console.log('Fetched dashboards');
        this.dashboards.next(dashboards);

        // create a dict with URIs as key for fast lookup
        const uris = {};
        for (const ds of dashboards) {
          uris[ds.uri] = ds;
        }
        this.dashboardUris.next(uris);

        this.dashboardsInitialized = true;
        this.serviceInitializedSuccessfully$.next(true);
      },
      error => {
        console.warn(`Couldn't fetch the list of Grafana Dashboards: ${error}`);
        this.serviceInitializedSuccessfully$.next(false);
      },
    );
  }

  public getDasbhboardUrlFromUri(uri: string): Observable<string> {
    return this.withServiceInitialized().pipe(
      map(_ => this.dashboardUris),
      concatAll(),
      map(uris => {
        if (!(uri in uris)) {
          const msg = `Grafana URI '${uri}' does not exist in list of known URIs`;
          throw msg;
        }

        return uris[uri].url;
      }),
    );
  }

  public getDashboardsInfo(): Observable<GrafanaDashboard[]> {
    const url = this.grafanaPrefix + '/api/search';

    return this.http.get<GrafanaDashboard[]>(url).pipe(
      catchError(error => {
        console.error('Error fetching Grafana dashboards:', error);
        return of([]); // Return empty array as fallback
      }),
      map((resp: GrafanaDashboard[]) => {
        return resp;
      }),
    );
  }

  private withServiceInitialized(): Observable<boolean> {
    return this.serviceInitializedSuccessfully$.pipe(
      map(init => {
        if (!init) {
          const msg = 'Initialization process was not completed successfully.';
          throw msg;
        }

        return true;
      }),
    );
  }
}
