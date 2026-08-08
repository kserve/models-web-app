import { NgZone } from '@angular/core';
import { SSEService, WatchEvent } from './sse.service';

class MockEventSource {
  static CONNECTING = 0;
  static instances: MockEventSource[] = [];

  readyState = 1;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: (() => void) | null = null;
  close = jest.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
}

describe('SSEService', () => {
  const originalEventSource = global.EventSource;
  let service: SSEService;

  beforeEach(() => {
    MockEventSource.instances = [];
    (global as any).EventSource = MockEventSource;
    service = new SSEService(new NgZone({ enableLongStackTrace: false }));
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  it('should URL-encode log watch component query parameters', () => {
    const subscription = service
      .watchLogs('kubeflow-user', 'model-a', [
        'predictor',
        'weird component=a&b',
      ])
      .subscribe();

    expect(MockEventSource.instances.map(instance => instance.url)).toEqual([
      'api/sse/namespaces/kubeflow-user/inferenceservices/model-a/logs?component=predictor&component=weird+component%3Da%26b',
    ]);

    subscription.unsubscribe();
    expect(MockEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it('should deliver messages to subscribers inside the Angular zone', () => {
    const received: Array<{
      event: WatchEvent<unknown>;
      inAngularZone: boolean;
    }> = [];

    const subscription = service
      .watchInferenceServices('kubeflow-user')
      .subscribe(event => {
        received.push({ event, inAngularZone: NgZone.isInAngularZone() });
      });
    const eventSource = MockEventSource.instances[0];

    // EventSource callbacks fire outside the Angular zone in production
    // because zone.js does not patch EventSource; the test invokes the
    // callback from outside the zone to reproduce that.
    expect(NgZone.isInAngularZone()).toBe(false);
    eventSource.onmessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'ADDED', object: { name: 'model-a' } }),
      }),
    );

    expect(received).toEqual([
      {
        event: { type: 'ADDED', object: { name: 'model-a' } },
        inAngularZone: true,
      },
    ]);

    subscription.unsubscribe();
  });

  it('should deliver JSON parse errors inside the Angular zone and close the connection', () => {
    const errors: Array<{ error: unknown; inAngularZone: boolean }> = [];

    service.watchInferenceServices('kubeflow-user').subscribe({
      error: error => {
        errors.push({ error, inAngularZone: NgZone.isInAngularZone() });
      },
    });
    const eventSource = MockEventSource.instances[0];

    expect(NgZone.isInAngularZone()).toBe(false);
    eventSource.onmessage(new MessageEvent('message', { data: 'not-json' }));

    expect(errors.length).toBe(1);
    expect(errors[0].error).toBeInstanceOf(SyntaxError);
    expect(errors[0].inAngularZone).toBe(true);
    expect(eventSource.close).toHaveBeenCalled();
  });

  it('should deliver connection errors inside the Angular zone and close the connection', () => {
    const errors: Array<{ error: unknown; inAngularZone: boolean }> = [];

    service.watchInferenceServices('kubeflow-user').subscribe({
      error: error => {
        errors.push({ error, inAngularZone: NgZone.isInAngularZone() });
      },
    });
    const eventSource = MockEventSource.instances[0];
    const errorEvent = new Event('error');

    expect(NgZone.isInAngularZone()).toBe(false);
    eventSource.onerror(errorEvent);

    expect(errors).toEqual([{ error: errorEvent, inAngularZone: true }]);
    expect(eventSource.close).toHaveBeenCalled();
  });

  it('should error inside the Angular zone after exhausting reconnect attempts', () => {
    const errors: Array<{ error: unknown; inAngularZone: boolean }> = [];

    service.watchInferenceServices('kubeflow-user').subscribe({
      error: error => {
        errors.push({ error, inAngularZone: NgZone.isInAngularZone() });
      },
    });
    const eventSource = MockEventSource.instances[0];
    eventSource.readyState = MockEventSource.CONNECTING;

    expect(NgZone.isInAngularZone()).toBe(false);
    eventSource.onerror(new Event('error'));
    eventSource.onerror(new Event('error'));
    expect(errors).toEqual([]);
    expect(eventSource.close).not.toHaveBeenCalled();

    eventSource.onerror(new Event('error'));

    expect(errors.length).toBe(1);
    expect((errors[0].error as Error).message).toBe(
      'SSE failed to reconnect after 3 attempts',
    );
    expect(errors[0].inAngularZone).toBe(true);
    expect(eventSource.close).toHaveBeenCalled();
  });
});
