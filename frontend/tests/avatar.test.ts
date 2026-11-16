import { describe, expect, it } from "vitest";
import { avatarUrl } from "../src/utils/avatar";

describe("avatarUrl", () => {
  it("accepts renderable avatar URLs", () => {
    expect(avatarUrl("https://example.com/avatar.png")).toBe("https://example.com/avatar.png");
    expect(avatarUrl("/uploads/avatar.png")).toBe("/uploads/avatar.png");
    expect(avatarUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });

  it("rejects Cloudinary storage keys and empty placeholders", () => {
    expect(avatarUrl("studylens_materials/avatar")).toBeNull();
    expect(avatarUrl("None")).toBeNull();
    expect(avatarUrl("null")).toBeNull();
    expect(avatarUrl("")).toBeNull();
  });
});
