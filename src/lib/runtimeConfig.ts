export type RuntimeConfig = {
  apiProtocol: "http" | "https";
  apiHost: string;
  apiPort?: string;
  apiBaseUrl: string;
};

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }

  interface ImportMetaEnv {
    readonly VITE_API_PROTOCOL?: "http" | "https";
    readonly VITE_API_HOST?: string;
    readonly VITE_API_PORT?: string;
    readonly VITE_API_BASE_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const defaultConfig: RuntimeConfig = {
  apiProtocol: "http",
  apiHost: "127.0.0.1",
  apiPort: "5003",
  apiBaseUrl: "http://127.0.0.1:5003",
};

export function getRuntimeConfig(): RuntimeConfig {
  const runtimeConfig = window.__RUNTIME_CONFIG__ ?? {};
  const config: RuntimeConfig = {
    ...defaultConfig,
    ...runtimeConfig,
  };

  if (import.meta.env.VITE_API_PROTOCOL) {
    config.apiProtocol = import.meta.env.VITE_API_PROTOCOL;
  }

  if (import.meta.env.VITE_API_HOST) {
    config.apiHost = import.meta.env.VITE_API_HOST;
  }

  if (import.meta.env.VITE_API_PORT !== undefined) {
    config.apiPort = import.meta.env.VITE_API_PORT;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    config.apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  } else {
    config.apiBaseUrl = config.apiPort
      ? `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`
      : `${config.apiProtocol}://${config.apiHost}`;
  }

  return {
    apiProtocol: config.apiProtocol,
    apiHost: config.apiHost,
    apiPort: config.apiPort,
    apiBaseUrl: config.apiBaseUrl.replace(/\/$/, ""),
  };
}
