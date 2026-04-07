import { beforeEach, expect, test, vi } from "vitest";
import { supportsInput } from "~/lib/model-capabilities";

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
  expect(await supportsInput(client as never, "image/jpeg")).toBe(true);
});

test("detects pdf support for claude model", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(await supportsInput(client as never, "application/pdf")).toBe(true);
});

test("detects no audio support for claude model", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(await supportsInput(client as never, "audio/mpeg")).toBe(false);
});

test("detects audio support for gpt model", async () => {
  const client = mockClient("openai/gpt-4o", defaultProviders);
  expect(await supportsInput(client as never, "audio/mpeg")).toBe(true);
});

test("detects no pdf support for gpt model", async () => {
  const client = mockClient("openai/gpt-4o", defaultProviders);
  expect(await supportsInput(client as never, "application/pdf")).toBe(false);
});

test("returns false for unsupported mime types", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(await supportsInput(client as never, "application/zip")).toBe(false);
  expect(await supportsInput(client as never, "text/plain")).toBe(false);
});

test("falls back to image-only when no model is configured", async () => {
  const client = mockClient(undefined, defaultProviders);
  expect(await supportsInput(client as never, "image/jpeg")).toBe(true);
  expect(await supportsInput(client as never, "application/pdf")).toBe(false);
});

test("falls back to image-only when model is not found", async () => {
  const client = mockClient("unknown/model", defaultProviders);
  expect(await supportsInput(client as never, "image/jpeg")).toBe(true);
  expect(await supportsInput(client as never, "application/pdf")).toBe(false);
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
  expect(await supportsInput(client as never, "image/jpeg")).toBe(true);
  expect(await supportsInput(client as never, "application/pdf")).toBe(false);
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
  expect(await supportsInput(client as never, "image/jpeg")).toBe(true);
  expect(await supportsInput(client as never, "application/pdf")).toBe(false);
});

test("handles uppercase MIME types", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(await supportsInput(client as never, "IMAGE/JPEG")).toBe(true);
  expect(await supportsInput(client as never, "Application/PDF")).toBe(true);
});

test("handles MIME types with parameters", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(
    await supportsInput(client as never, "image/jpeg; charset=binary"),
  ).toBe(true);
  expect(
    await supportsInput(client as never, "application/pdf; version=1.4"),
  ).toBe(true);
});

test("matches model by short name", async () => {
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
  expect(await supportsInput(client as never, "application/pdf")).toBe(true);
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
  expect(await supportsInput(client as never, "application/pdf")).toBe(true);
});

test("returns false for video when model does not support it", async () => {
  const client = mockClient(
    "anthropic/claude-sonnet-4-20250514",
    defaultProviders,
  );
  expect(await supportsInput(client as never, "video/mp4")).toBe(false);
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
  expect(await supportsInput(client as never, "video/mp4")).toBe(true);
});
