export interface AppConfig {
  grafanaPrefix: string;
  grafanaCpuMemoryDb: string;
  grafanaHttpRequestsDb: string;
  sseEnabled?: boolean;
}
