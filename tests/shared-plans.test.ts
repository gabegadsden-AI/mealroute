import { describe, it, expect } from "vitest";

describe("SharedPlans module", () => {
  it("can import the module without errors", async () => {
    const mod = await import("../lib/shared-plans");
    expect(typeof mod.createSharedPlan).toBe("function");
    expect(typeof mod.loadSharedPlanByToken).toBe("function");
    expect(typeof mod.deleteSharedPlan).toBe("function");
    expect(typeof mod.listUserSharedPlans).toBe("function");
  });
});
