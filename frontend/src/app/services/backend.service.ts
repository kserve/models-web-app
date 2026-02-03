import { Injectable } from '@angular/core';
import { BackendService, SnackBarService, K8sObject } from 'kubeflow';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { InferenceServiceK8s } from '../types/kfserving/v1beta1';
import { InferenceGraphK8s } from '../types/kfserving/v1alpha1';
import { MWABackendResponse, InferenceServiceLogs } from '../types/backend';
import { EventObject } from '../types/event';

@Injectable({
  providedIn: 'root',
})
export class MWABackendService extends BackendService {
  constructor(public http: HttpClient, public snack: SnackBarService) {
    super(http as any, snack as any);
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
    ) as any;
  }

  public getInferenceServices(
    ns: string | string[],
  ): Observable<InferenceServiceK8s[]> {
    if (Array.isArray(ns)) {
      return this.getInferenceServicesAllNamespaces(ns);
    }

    return this.getInferenceServicesSingleNamespace(ns);
  }

  /*
   * InferenceGraph GETters
   */
  public getInferenceGraph(
    namespace: string,
    name: string,
  ): Observable<InferenceGraphK8s> {
    const url = `api/namespaces/${namespace}/inferencegraphs/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.inferenceGraph;
      }),
    );
  }

  private getInferenceGraphsSingleNamespace(
    namespace: string,
  ): Observable<InferenceGraphK8s[]> {
    const url = `api/namespaces/${namespace}/inferencegraphs`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.inferenceGraphs;
      }),
    );
  }

  private getInferenceGraphsAllNamespaces(
    namespaces: string[],
  ): Observable<InferenceGraphK8s[]> {
    return this.getObjectsAllNamespaces(
      this.getInferenceGraphsSingleNamespace.bind(this),
      namespaces,
    ) as any;
  }

  public getInferenceGraphs(
    ns: string | string[],
  ): Observable<InferenceGraphK8s[]> {
    if (Array.isArray(ns)) {
      return this.getInferenceGraphsAllNamespaces(ns);
    }

    return this.getInferenceGraphsSingleNamespace(ns);
  }

  public getInferenceGraphEvents(
    inferenceGraph: InferenceGraphK8s,
  ): Observable<EventObject[]> {
    const name = inferenceGraph.metadata.name;
    const namespace = inferenceGraph.metadata.namespace;
    const url = `api/namespaces/${namespace}/inferencegraphs/${name}/events`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error, false)),
      map((resp: MWABackendResponse) => resp.events),
    );
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

  public getInferenceServiceContainers(
    svc: InferenceServiceK8s,
    component: string,
  ): Observable<string[]> {
    const name = svc.metadata.name;
    const namespace = svc.metadata.namespace;

    const url = `api/namespaces/${namespace}/inferenceservices/${name}/components/${component}/pods/containers`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error, false)),
      map((resp: MWABackendResponse) => {
        return resp.containers;
      }),
    );
  }

  public getInferenceServiceLogs(
    svc: InferenceServiceK8s,
    component: string,
    container: string,
  ): Observable<string[]> {
    const name = svc.metadata.name;
    const namespace = svc.metadata.namespace;

    const url = `api/namespaces/${namespace}/inferenceservices/${name}/components/${component}/pods/containers/${container}/logs`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error, false)),
      map((resp: MWABackendResponse) => {
        return resp.logs;
      }),
    );
  }

  public getInferenceServiceEvents(
    inferenceService: InferenceServiceK8s,
  ): Observable<EventObject[]> {
    const name = inferenceService.metadata.name;
    const namespace = inferenceService.metadata.namespace;
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
    inferenceService: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const ns = inferenceService.metadata.namespace;
    const url = `api/namespaces/${ns}/inferenceservices`;

    return this.http
      .post<MWABackendResponse>(url, inferenceService)
      .pipe(catchError(error => this.handleError(error)));
  }

  public postInferenceGraph(
    inferenceGraph: InferenceGraphK8s,
  ): Observable<MWABackendResponse> {
    const ns = inferenceGraph.metadata.namespace;
    const url = `api/namespaces/${ns}/inferencegraphs`;

    return this.http
      .post<MWABackendResponse>(url, inferenceGraph)
      .pipe(catchError(error => this.handleError(error)));
  }

  /*
   * PUT
   */
  public editInferenceService(
    namespace: string,
    name: string,
    updatedInferenceService: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const url = `api/namespaces/${namespace}/inferenceservices/${name}`;

    return this.http
      .put<MWABackendResponse>(url, updatedInferenceService)
      .pipe(catchError(error => this.handleError(error)));
  }

  public editInferenceGraph(
    namespace: string,
    name: string,
    updatedInferenceGraph: InferenceGraphK8s,
  ): Observable<MWABackendResponse> {
    const url = `api/namespaces/${namespace}/inferencegraphs/${name}`;

    return this.http
      .put<MWABackendResponse>(url, updatedInferenceGraph)
      .pipe(catchError(error => this.handleError(error)));
  }

  /*
   * Standard mode methods
   */
  public getKubernetesDeployment(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/deployments/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.deployment;
      }),
    );
  }

  public getKubernetesService(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/services/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.service;
      }),
    );
  }

  public getKubernetesHPA(
    namespace: string,
    name: string,
  ): Observable<K8sObject> {
    const url = `api/namespaces/${namespace}/hpas/${name}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.hpa;
      }),
    );
  }

  public getStandardDeploymentObjects(
    namespace: string,
    name: string,
    component: string,
  ): Observable<any> {
    const url = `api/namespaces/${namespace}/inferenceservices/${name}/standard/${component}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.standardDeploymentObjects;
      }),
    );
  }

  public getModelMeshObjects(
    namespace: string,
    name: string,
    component: string,
  ): Observable<any> {
    const url = `api/namespaces/${namespace}/inferenceservices/${name}/modelmesh/${component}`;

    return this.http.get<MWABackendResponse>(url).pipe(
      catchError(error => this.handleError(error)),
      map((resp: MWABackendResponse) => {
        return resp.modelmeshObjects;
      }),
    );
  }

  /*
   * DELETE
   */
  public deleteInferenceService(
    inferenceService: InferenceServiceK8s,
  ): Observable<MWABackendResponse> {
    const ns = inferenceService.metadata.namespace;
    const nm = inferenceService.metadata.name;
    const url = `api/namespaces/${ns}/inferenceservices/${nm}`;

    return this.http
      .delete<MWABackendResponse>(url)
      .pipe(catchError(error => this.handleError(error, false)));
  }

  public deleteInferenceGraph(
    inferenceGraph: InferenceGraphK8s,
  ): Observable<MWABackendResponse> {
    const ns = inferenceGraph.metadata.namespace;
    const nm = inferenceGraph.metadata.name;
    const url = `api/namespaces/${ns}/inferencegraphs/${nm}`;

    return this.http
      .delete<MWABackendResponse>(url)
      .pipe(catchError(error => this.handleError(error, false)));
  }
}
