import { Injectable, NgZone } from '@angular/core';
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
  constructor(private angularZone: NgZone) {}

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
      const params = new URLSearchParams();
      components.forEach(component => params.append('component', component));
      url += `?${params.toString()}`;
    }

    return this.createEventSource<any>(url);
  }

  private createEventSource<T>(url: string): Observable<WatchEvent<T>> {
    return new Observable(observer => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      const eventSource = new EventSource(url);

      // EventSource is not patched by zone.js, so its callbacks run outside
      // the Angular zone. Emitting through NgZone.run keeps change detection
      // and event listener registration in downstream subscribers inside the
      // zone; without this, views updated from SSE events render stale and
      // clicks on them navigate without repainting.
      eventSource.onmessage = (event: MessageEvent) => {
        if (!event.data || event.data.trim() === '') {
          return;
        }

        try {
          const data: WatchEvent<T> = JSON.parse(event.data);
          this.angularZone.run(() => observer.next(data));
          reconnectAttempts = 0;
        } catch (parseError) {
          this.angularZone.run(() => observer.error(parseError));
          eventSource.close();
        }
      };

      eventSource.onerror = (error: Event) => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          reconnectAttempts++;
          if (reconnectAttempts >= maxReconnectAttempts) {
            this.angularZone.run(() =>
              observer.error(
                new Error(
                  `SSE failed to reconnect after ${maxReconnectAttempts} attempts`,
                ),
              ),
            );
            eventSource.close();
          }
          return;
        }
        this.angularZone.run(() => observer.error(error));
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
