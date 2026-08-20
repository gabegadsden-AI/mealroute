import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    alias: {
      "server-only": resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
});
