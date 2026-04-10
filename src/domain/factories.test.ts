import { afterEach, describe, expect, it, vi } from "vitest";
import { createCategoryEntity, createPageEntity } from "./factories";

describe("factories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "uuid-from-browser"
    } as unknown as Crypto);

    expect(createPageEntity().id).toBe("page-uuid-from-browser");
  });

  it("falls back to getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (values: Uint8Array) => {
        for (let index = 0; index < values.length; index += 1) {
          values[index] = index;
        }

        return values;
      }
    } as unknown as Crypto);

    expect(createCategoryEntity("Fallback").id).toMatch(
      /^category-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
