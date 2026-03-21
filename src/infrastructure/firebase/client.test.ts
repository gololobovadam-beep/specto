import { describe, expect, it } from "vitest";
import { resolveFirebaseAuthDomain } from "./client";

function createBrowserWindow(url: string) {
  return {
    location: new URL(url) as unknown as Window["location"]
  };
}

describe("resolveFirebaseAuthDomain", () => {
  it("prefers the current web.app domain for the same Firebase project", () => {
    expect(
      resolveFirebaseAuthDomain(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://spectus-33cfe.web.app/pages/alpha")
      )
    ).toBe("spectus-33cfe.web.app");
  });

  it("prefers the current firebaseapp.com domain for the same Firebase project", () => {
    expect(
      resolveFirebaseAuthDomain(
        "spectus-33cfe.web.app",
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/pages/alpha")
      )
    ).toBe("spectus-33cfe.firebaseapp.com");
  });

  it("keeps the configured auth domain for unrelated hosts", () => {
    expect(
      resolveFirebaseAuthDomain(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://example.com/pages/alpha")
      )
    ).toBe("spectus-33cfe.firebaseapp.com");
  });

  it("returns the configured auth domain when browser context is unavailable", () => {
    expect(resolveFirebaseAuthDomain("spectus-33cfe.firebaseapp.com", null)).toBe(
      "spectus-33cfe.firebaseapp.com"
    );
  });
});
