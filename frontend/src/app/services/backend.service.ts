import { Injectable } from '@angular/core';
import { BackendService, SnackBarService, K8sObject } from 'kubeflow';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { InferenceServiceK8s } from '../types/kfserving/v1beta1';
import { MWABackendResponse, InferenceServiceLogs } from '../types/backend';
import { EventObject } from '../types/event';

@Injectable({
  providedIn: 'root',
})
export class MWABackendService extends BackendService {
  constructor(public http: HttpClient, public snack: SnackBarService) {
    super(http, snack);
  }

  /*
   * GETters
   */
  public getInferenceService(
    namespace: string,
    name: string,
  ): Observable<InferenceServiceK8s> {
    const url = `api/namespaces/${namespace}/inferenceservices/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.inferenceService;
      }),
    );
  }

  private getInferenceServicesSingleNamespace(
    namespace: string,
  ): Observable<InferenceServiceK8s[]> {
    const url = `api/namespaces/${namespace}/inferenceservices`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.inferenceServices;
      }),
    );
  }

  private getInferenceServicesAllNamespaces(
    namespaces: string[],
  ): Observable<InferenceServiceK8s[]> {
    return this.getObjectsAllNamespaces(
      this.getInferenceServicesSingleNamespace.bind(this),
      namespaces,
    );
  }

  public getInferenceServices(
    ns: string | string[],
  ): Observable<InferenceServiceK8s[]> {
    if (Array.isArray(ns)) {
      return this.getInferenceServicesAllNamespaces(ns);
    }

    return this.getInferenceServicesSingleNamespace(ns);
  }

  public getKnativeService(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/knativeServices/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.knativeService;
      }),
    );
  }

  public getKnativeConfiguration(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/configurations/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.knativeConfiguration;
      }),
    );
  }

  public getKnativeRevision(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/revisions/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.knativeRevision;
      }),
    );
  }

  public getKnativeRoute(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/routes/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.knativeRoute;
      }),
    );
  }

  public getInferenceServiceLogs(
    svc: InferenceServiceK8s,
    components: string[] = [],
  ): Observable<InferenceServiceLogs> {
    const name = svc.metadata.name;
    const namespace = svc.metadata.namespace;
    let url = `api/namespaces/${namespace}/inferenceservices/${name}?logs=true`;

    ['predictor', 'explainer', 'transformer'].forEach(component => {
      if (component in svc.spec) {
        url += `&component=${component}`;
      }
    });

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error, false)),
      map((resp: MWABackendResponse) => {
        return resp.serviceLogs;
      }),
    );
  }

  public getInferenceServiceEvents(
    svc: InferenceServiceK8s,
  ): Observable<EventObject[]> {
    const name = svc.metadata.name;
    const namespace = svc.metadata.namespace;
    const url = `api/namespaces/${namespace}/inferenceservices/${name}/events`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error, false)),
      map((resp: MWABackendResponse) => resp.events),
    );
  }

  /*
   * POST
   */
  public postInferenceService(
    svc: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const ns = svc.metadata.namespace;
    const url = `api/namespaces/${ns}/inferenceservices`;

    return this.http
      .post<MWABackendResponse>(url, svc)
      .pipe(catchError(error => this.handleError(error)));
  }

  /*
   * PUT
   */
  public editInferenceService(
    namespace: string,
    name: string,
    updatedIsvc: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const url = `api/namespaces/${namespace}/inferenceservices/${name}`;

    return this.http
      .put<MWABackendResponse>(url, updatedIsvc)
      .pipe(catchError(error => this.handleError(error)));
  }

  /*
   * DELETE
   */
  public deleteInferenceService(
    svc: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const ns = svc.metadata.namespace;
    const nm = svc.metadata.name;
    const url = `api/namespaces/${ns}/inferenceservices/${nm}`;

    return this.http
      .delete<MWABackendResponse>(url)
      .pipe(catchError(error => this.handleError(error, false)));
  }
}
