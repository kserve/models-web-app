import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BackendService, SnackBarService } from 'kubeflow';
import { ReplaySubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AppConfig } from '../types/config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService extends BackendService {
  private config$ = new ReplaySubject<AppConfig>(1);
  private configLoaded = false;

  constructor(public http: HttpClient, public snack: SnackBarService) {
    super(http, snack);
    this.config$.next(this.getDefaultConfig());
    this.loadConfig();
  }

  private loadConfig(): void {
    console.log('Loading application configuration');

    this.http
      .get<AppConfig>('api/config')
      .pipe(
        catchError(error => {
          console.warn(
            'Failed to load config from backend, using defaults:',
            error,
          );
          return of(this.getDefaultConfig());
        }),
        tap(config => {
          console.log('Configuration loaded:', config);
          this.configLoaded = true;
        }),
      )
      .subscribe(
        config => this.config$.next(config),
        error => {
          console.error('Error loading configuration:', error);
          this.config$.next(this.getDefaultConfig());
          this.configLoaded = true;
        },
      );
  }

  private getDefaultConfig(): AppConfig {
    return {
      grafanaPrefix: '/grafana',
      grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
      grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
    };
  }

  public getConfig(): Observable<AppConfig> {
    return this.config$.asObservable();
  }

  public isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  public reloadConfig(): void {
    this.configLoaded = false;
    this.loadConfig();
  }
}
