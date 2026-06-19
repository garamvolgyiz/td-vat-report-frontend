import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeConfig } from "./runtimeConfig";

describe("getRuntimeConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.__RUNTIME_CONFIG__ = undefined;
  });

  it("uses Vite env values for API settings", () => {
    vi.stubEnv("VITE_API_PROTOCOL", "https");
    vi.stubEnv("VITE_API_HOST", "api.example.test");
    vi.stubEnv("VITE_API_PORT", "");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");

    expect(getRuntimeConfig()).toEqual({
      apiProtocol: "https",
      apiHost: "api.example.test",
      apiPort: "",
      apiBaseUrl: "https://api.example.test",
    });
  });
});
