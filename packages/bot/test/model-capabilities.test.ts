import { beforeEach, expect, test, vi } from "vitest";
import { ModelCapabilities } from "~/lib/model-capabilities";

beforeEach(() => {
  vi.resetAllMocks();
});

function mockClient(
  model: string | undefined,
  providers: ReadonlyArray<{
    models: {
      [key: string]: {
        id: string;
        capabilities: {
          input: {
            image: boolean;
            pdf: boolean;
            audio: boolean;
            video: boolean;
          };
        };
      };
    };
  }>,
) {
  return {
    config: {
      get: vi.fn(async () => ({ data: { model } })),
      providers: vi.fn(async () => ({ data: { providers } })),
    },
  };
}

const claudeModel = {
  id: "claude-sonnet-4-20250514",
  capabilities: {
    input: { image: true, pdf: true, audio: false, video: false },
  },
};

const gptModel = {
  id: "gpt-4o",
  capabilities: {
    input: { image: true, pdf: false, audio: true, video: false },
  },
};

const defaultProviders = [
  { models: { "anthropic/claude-sonnet-4-20250514": claudeModel } },
  { models: { "openai/gpt-4o": gptModel } },
];

test("detects image support for claude model", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg")).toBe(true);
  expect(await mc.supportsInput("image/png")).toBe(true);
});

test("detects pdf support for claude model", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/pdf")).toBe(true);
});

test("detects no audio support for claude model", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("audio/mpeg")).toBe(false);
});

test("detects audio support for gpt model", async () => {
  const client = mockClient("openai/gpt-4o", defaultProviders);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("audio/mpeg")).toBe(true);
});

test("detects no pdf support for gpt model", async () => {
  const client = mockClient("openai/gpt-4o", defaultProviders);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/pdf")).toBe(false);
});

test("returns false for unsupported mime types", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/zip")).toBe(false);
  expect(await mc.supportsInput("application/octet-stream")).toBe(false);
  expect(await mc.supportsInput("text/plain")).toBe(false);
});

test("caches capabilities after first resolve", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  await mc.supportsInput("image/jpeg");
  await mc.supportsInput("image/png");
  await mc.supportsInput("application/pdf");

  expect(client.config.get).toHaveBeenCalledOnce();
  expect(client.config.providers).toHaveBeenCalledOnce();
});

test("invalidate clears cache and re-fetches", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  await mc.supportsInput("image/jpeg");
  expect(client.config.get).toHaveBeenCalledOnce();

  mc.invalidate();
  await mc.supportsInput("image/jpeg");
  expect(client.config.get).toHaveBeenCalledTimes(2);
});

test("falls back to image-only when no model is configured", async () => {
  const client = mockClient(undefined, defaultProviders);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg")).toBe(true);
  expect(await mc.supportsInput("application/pdf")).toBe(false);
  expect(client.config.providers).not.toHaveBeenCalled();
});

test("falls back to image-only when model is not found in providers", async () => {
  const client = mockClient("unknown/model", defaultProviders);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg")).toBe(true);
  expect(await mc.supportsInput("application/pdf")).toBe(false);
});

test("falls back to image-only when config.get throws", async () => {
  const client = {
    config: {
      get: vi.fn(async () => {
        throw new Error("network error");
      }),
      providers: vi.fn(),
    },
  };
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg")).toBe(true);
  expect(await mc.supportsInput("application/pdf")).toBe(false);
  expect(client.config.providers).not.toHaveBeenCalled();
});

test("falls back to image-only when config.providers throws", async () => {
  const client = {
    config: {
      get: vi.fn(async () => ({
        data: { model: "anthropic/claude-sonnet-4-20250514" },
      })),
      providers: vi.fn(async () => {
        throw new Error("network error");
      }),
    },
  };
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg")).toBe(true);
  expect(await mc.supportsInput("application/pdf")).toBe(false);
});

test("matches model by short name when full key does not match", async () => {
  const providers = [
    {
      models: {
        "claude-sonnet-4-20250514": {
          id: "claude-sonnet-4-20250514",
          capabilities: {
            input: { image: true, pdf: true, audio: false, video: false },
          },
        },
      },
    },
  ];
  const client = mockClient("anthropic/claude-sonnet-4-20250514", providers);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/pdf")).toBe(true);
});

test("returns false for video when model does not support it", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("video/mp4")).toBe(false);
});

test("returns true for video when model supports it", async () => {
  const providers = [
    {
      models: {
        "custom/video-model": {
          id: "video-model",
          capabilities: {
            input: { image: true, pdf: false, audio: false, video: true },
          },
        },
      },
    },
  ];
  const client = mockClient("custom/video-model", providers);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("video/mp4")).toBe(true);
});

test("concurrent calls share the same in-flight request", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  const [r1, r2, r3] = await Promise.all([
    mc.supportsInput("image/jpeg"),
    mc.supportsInput("application/pdf"),
    mc.supportsInput("audio/mpeg"),
  ]);

  expect(r1).toBe(true);
  expect(r2).toBe(true);
  expect(r3).toBe(false);
  expect(client.config.get).toHaveBeenCalledOnce();
  expect(client.config.providers).toHaveBeenCalledOnce();
});

test("handles uppercase MIME types", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("IMAGE/JPEG")).toBe(true);
  expect(await mc.supportsInput("Application/PDF")).toBe(true);
  expect(await mc.supportsInput("AUDIO/MPEG")).toBe(false);
});

test("handles MIME types with parameters", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("image/jpeg; charset=binary")).toBe(true);
  expect(await mc.supportsInput("application/pdf; version=1.4")).toBe(true);
});

test("matches model by model.id field", async () => {
  const providers = [
    {
      models: {
        "some-internal-key": {
          id: "anthropic/claude-sonnet-4-20250514",
          capabilities: {
            input: { image: true, pdf: true, audio: false, video: false },
          },
        },
      },
    },
  ];
  const client = mockClient("anthropic/claude-sonnet-4-20250514", providers);
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/pdf")).toBe(true);
});

test("invalidate after error allows re-fetch", async () => {
  const client = {
    config: {
      get: vi.fn(),
      providers: vi.fn(),
    },
  };
  client.config.get.mockRejectedValueOnce(new Error("network error"));
  client.config.get.mockResolvedValueOnce({
    data: { model: "anthropic/claude-sonnet-4-20250514" },
  });
  client.config.providers.mockResolvedValueOnce({
    data: { providers: defaultProviders },
  });
  const mc = ModelCapabilities.create(client as never);

  expect(await mc.supportsInput("application/pdf")).toBe(false);

  mc.invalidate();

  expect(await mc.supportsInput("application/pdf")).toBe(true);
  expect(client.config.get).toHaveBeenCalledTimes(2);
});
