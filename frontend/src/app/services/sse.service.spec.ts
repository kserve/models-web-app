import { SSEService } from './sse.service';

describe('SSEService', () => {
  const originalEventSource = global.EventSource;
  let openedUrls: string[];
  let close: jest.Mock;

  beforeEach(() => {
    openedUrls = [];
    close = jest.fn();

    (global as any).EventSource = class {
      static CONNECTING = 0;
      readyState = 1;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onopen: (() => void) | null = null;

      constructor(url: string) {
        openedUrls.push(url);
      }

      close = close;
    };
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  it('should URL-encode log watch component query parameters', () => {
    const service = new SSEService();

    const subscription = service
      .watchLogs('kubeflow-user', 'model-a', [
        'predictor',
        'weird component=a&b',
      ])
      .subscribe();

    expect(openedUrls).toEqual([
      'api/sse/namespaces/kubeflow-user/inferenceservices/model-a/logs?component=predictor&component=weird+component%3Da%26b',
    ]);

    subscription.unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
