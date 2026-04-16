import type { DocsCollection } from "fumadocs-mdx/config";
import {
  defineConfig,
  defineDocs,
  type frontmatterSchema,
  type metaSchema,
} from "fumadocs-mdx/config";

export const docs: DocsCollection<typeof frontmatterSchema, typeof metaSchema> =
  defineDocs({ dir: "content/docs" });

export default defineConfig();
