import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Interface for SSE watch events
 */
export interface WatchEvent<T> {
  type: 'INITIAL' | 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR' | 'UPDATE';
  object?: T;
  items?: T[];
  logs?: any;
  message?: string;
}

/**
 * Service for handling Server-Sent Events (SSE) connections
 */
@Injectable({
  providedIn: 'root',
})
export class SSEService {
  constructor() {}

  /**
   * Watch all InferenceServices in a namespace
   */
  public watchInferenceServices<T>(
    namespace: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices`;
    return this.createEventSource<T>(url);
  }

  /**
   * Watch a single InferenceService
   */
  public watchInferenceService<T>(
    namespace: string,
    name: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices/${name}`;
    return this.createEventSource<T>(url);
  }

  /**
   * Watch Kubernetes events for an InferenceService
   */
  public watchEvents<T>(
    namespace: string,
    name: string,
  ): Observable<WatchEvent<T>> {
    const url = `api/sse/namespaces/${namespace}/inferenceservices/${name}/events`;
    return this.createEventSource<T>(url);
  }

  /**
   * Watch logs for an InferenceService
   */
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

  /**
   * Create an EventSource and return an Observable
   */
  private createEventSource<T>(url: string): Observable<WatchEvent<T>> {
    return new Observable(observer => {
      let eventSource: EventSource;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;

      try {
        eventSource = new EventSource(url);

        eventSource.onmessage = (event: MessageEvent) => {
          try {
            // Skip heartbeat messages
            if (!event.data || event.data.trim() === '') {
              return;
            }

            const data: WatchEvent<T> = JSON.parse(event.data);
            observer.next(data);
            reconnectAttempts = 0; // Reset on successful message
          } catch (error) {
            console.error('Error parsing SSE message:', error);
            observer.error(error);
          }
        };

        eventSource.onerror = (error: Event) => {
          console.error('SSE connection error:', error);

          // Check if the connection is closed
          if (eventSource.readyState === EventSource.CLOSED) {
            reconnectAttempts++;

            if (reconnectAttempts >= maxReconnectAttempts) {
              observer.error(
                new Error(
                  `SSE connection closed after ${maxReconnectAttempts} attempts`,
                ),
              );
              eventSource.close();
            } else {
              console.log(
                `SSE connection closed, will attempt to reconnect (attempt ${reconnectAttempts}/${maxReconnectAttempts})`,
              );
              // EventSource automatically reconnects, just log it
            }
          } else if (eventSource.readyState === EventSource.CONNECTING) {
            console.log('SSE reconnecting...');
          } else {
            // Connection error, but may reconnect automatically
            observer.error(error);
          }
        };

        eventSource.onopen = () => {
          console.log('SSE connection established:', url);
          reconnectAttempts = 0;
        };
      } catch (error) {
        observer.error(error);
      }

      // Cleanup function
      return () => {
        if (eventSource) {
          console.log('Closing SSE connection:', url);
          eventSource.close();
        }
      };
    });
  }
}
