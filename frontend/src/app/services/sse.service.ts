import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface WatchEvent<T> {
  type: 'INITIAL' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR' | 'UPDATE';
  object?: T;
  items?: T[];
  logs?: any;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  constructor() {}

  public watchInferenceServices<T>(
    namespace: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices`;
    return this.createEventSource<T>(url);
  }

  public watchInferenceService<T>(
    namespace: string,
    name: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices/${name}`;
    return this.createEventSource<T>(url);
  }

  public watchEvents<T>(
    namespace: string,
    name: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices/${name}/events`;
    return this.createEventSource<T>(url);
  }

  public watchLogs(
    namespace: string,
    name: string,
    components?: string[],
  ): Observable<WatchEvent<any>> {
    let url = `api/sse/namespaces/${namespace}/inferenceservices/${name}/logs`;

    if (components && components.length > 0) {
      const params = components.map(c => `component=${c}`).join('&');
      url += `?${params}`;
    }

    return this.createEventSource<any>(url);
  }

  private createEventSource<T>(url: string): Observable<WatchEvent<T>> {
    return new Observable(observer => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      const eventSource = new EventSource(url);

      eventSource.onmessage = (event: MessageEvent) => {
        if (!event.data || event.data.trim() === '') {
          return;
        }

        const data: WatchEvent<T> = JSON.parse(event.data);
        observer.next(data);
        reconnectAttempts = 0;
      };

      eventSource.onerror = (error: Event) => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          reconnectAttempts++;
          if (reconnectAttempts >= maxReconnectAttempts) {
            observer.error(
              new Error(
                `SSE failed to reconnect after ${maxReconnectAttempts} attempts`,
              ),
            );
            eventSource.close();
          }
          return;
        }
        observer.error(error);
        eventSource.close();
      };

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      return () => {
        if (eventSource) {
          eventSource.close();
        }
      };
    });
  }
}
