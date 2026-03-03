import { describe, expect, it } from "vitest";
import { buildOpsDashboard } from "./dashboard.service.js";

describe("buildOpsDashboard", () => {
  it("forbids access when user has no organizer membership", async () => {
    const db: any = {
      membership: {
        findFirst: async () => null
      }
    };

    await expect(buildOpsDashboard({ userId: "u1", email: "x@test" }, db)).rejects.toThrow("FORBIDDEN");
  });

  it("returns contract shape with empty-safe defaults", async () => {
    const db: any = {
      membership: {
        findFirst: async () => ({ organizerId: "11111111-1111-1111-1111-111111111111" })
      },
      order: {
        groupBy: async () => [],
        aggregate: async () => ({ _sum: { totalCents: 0, subtotalCents: 0 } })
      },
      latePaymentCase: {
        count: async () => 0
      },
      inventoryReservation: {
        count: async () => 0
      },
      domainEvent: {
        findMany: async () => []
      }
    };

    const result = await buildOpsDashboard({ userId: "u1", email: "x@test" }, db);

    expect(result).toEqual({
      window24h: {
        ordersTotal: 0,
        paid: 0,
        pending: 0,
        expired: 0,
        grossAmount: 0,
        netAmount: 0
      },
      window7d: {
        ordersTotal: 0,
        paid: 0,
        grossAmount: 0,
        netAmount: 0
      },
      risk: {
        latePaymentCases: 0,
        reservationsExpiringSoon: 0
      },
      activity: []
    });
  });
});
