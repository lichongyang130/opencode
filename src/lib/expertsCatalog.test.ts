import { describe, expect, it } from "vitest";
import { PERSONAS } from "./personas";
import { metaOf, searchExperts } from "./expertsCatalog";

describe("expertsCatalog", () => {
  it("every persona except none has pitch and 3 starters", () => {
    for (const p of PERSONAS.filter((x) => x.id !== "none")) {
      const m = metaOf(p.id);
      expect(m.pitch.length).toBeGreaterThan(4);
      expect(m.starters.length).toBe(3);
    }
  });

  it("search hits skill words", () => {
    const list = PERSONAS.filter((p) => p.id !== "none");
    expect(searchExperts("PRD", list).some((p) => p.id === "pm")).toBe(true);
    expect(searchExperts("ARR", list).some((p) => p.id === "pitch-coach")).toBe(true);
  });
});
