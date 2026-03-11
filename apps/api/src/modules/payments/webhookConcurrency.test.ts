import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { hasIntegrationEnv } from "./integrationTestEnv.js";

if (!process.env.API_PORT) process.env.API_PORT = "3399";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-min-24-ch";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-24-ch";
process.env.QR_SECRET ||= "test-qr-secret-min-24-ch";
process.env.PAYMENTS_WEBHOOK_SECRET ||= "test-webhook-secret-min-24-ch";
process.env.NODE_ENV ||= "test";

const provider = "test-provider";
const baseUrl = `http://127.0.0.1:${process.env.API_PORT}`;

let created = {
  organizerId: "",
  eventId: "",
  ticketTypeId: "",
  orderId: "",
  providerEventId: "",
  providerRef: ""
};

async function waitForHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not become healthy in time");
}

describe.skipIf(!hasIntegrationEnv)("webhook concurrency", () => {
  beforeAll(async () => {
    expect(process.env.DATABASE_URL, "DATABASE_URL is required for webhook concurrency integration test").toBeTruthy();

    await import("../../server.js");
    await waitForHealth();

    const suffix = Date.now().toString();
    const organizer = await prisma.organizer.create({
      data: {
        name: `Race Org ${suffix}`,
        slug: `race-org-${suffix}`,
        serviceFeeBps: 0,
        taxBps: 0
      }
    });

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        name: `Race Event ${suffix}`,
        slug: `race-event-${suffix}`,
        timezone: "America/Buenos_Aires",
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        capacity: 100,
        visibility: "published"
      }
    });

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: "General",
        priceCents: 1000,
        currency: "ARS",
        quota: 100,
        remaining: 99,
        maxPerOrder: 10
      }
    });

    const order = await prisma.order.create({
      data: {
        organizerId: organizer.id,
        eventId: event.id,
        customerEmail: "race@test.local",
        status: "reserved",
        orderNumber: `RACE-${suffix}`,
        subtotalCents: 1000,
        totalCents: 1000,
        feeCents: 0,
        taxCents: 0,
        reservedUntil: new Date(Date.now() + 10 * 60 * 1000),
        items: {
          create: [{
            ticketTypeId: ticketType.id,
            quantity: 1,
            unitPriceCents: 1000,
            totalCents: 1000
          }]
        },
        reservations: {
          create: [{
            ticketTypeId: ticketType.id,
            quantity: 1,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          }]
        }
      }
    });

    created = {
      organizerId: organizer.id,
      eventId: event.id,
      ticketTypeId: ticketType.id,
      orderId: order.id,
      providerEventId: `race-test-${suffix}`,
      providerRef: `provider-ref-${suffix}`
    };
  });

  afterAll(async () => {
    if (!created.orderId) return;

    await prisma.confirmIdempotencyKey.deleteMany({ where: { orderId: created.orderId } });
    await prisma.domainEvent.deleteMany({ where: { orderId: created.orderId } });
    await prisma.ticket.deleteMany({ where: { orderId: created.orderId } });
    await prisma.paymentEvent.deleteMany({ where: { provider, providerEventId: created.providerEventId } });
    await prisma.payment.deleteMany({ where: { orderId: created.orderId } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: created.orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: created.orderId } });
    await prisma.order.deleteMany({ where: { id: created.orderId } });
    await prisma.ticketType.deleteMany({ where: { id: created.ticketTypeId } });
    await prisma.event.deleteMany({ where: { id: created.eventId } });
    await prisma.organizer.deleteMany({ where: { id: created.organizerId } });
  });

  it("dedupes duplicate provider event envelope and applies paid effects exactly once", async () => {
    const payload = {
      id: created.providerEventId,
      type: "payment.succeeded",
      data: {
        id: created.providerRef,
        metadata: { orderId: created.orderId }
      }
    };

    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/webhooks/payments/${provider}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }),
      fetch(`${baseUrl}/webhooks/payments/${provider}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
    ]);

    expect(r1.status).toBeLessThan(300);
    expect(r2.status).toBeLessThan(300);

    const b1 = await r1.json();
    const b2 = await r2.json();
    const dedupedCount = [b1, b2].filter((b) => b?.deduped === true).length;
    const storedCount = [b1, b2].filter((b) => b?.deduped === false).length;
    expect(storedCount).toBe(1);
    expect(dedupedCount).toBe(1);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.orderId },
      include: { tickets: true }
    });

    expect(order.status).toBe("paid");
    expect(order.tickets.length).toBe(1);

    const paymentEvents = await prisma.paymentEvent.findMany({
      where: { provider, providerEventId: created.providerEventId }
    });
    expect(paymentEvents.length).toBe(1);
    expect(paymentEvents[0].processedAt).toBeTruthy();
    expect(paymentEvents[0].processError).toBeNull();

    const payments = await prisma.payment.findMany({
      where: { orderId: created.orderId, provider, providerRef: created.providerRef }
    });
    expect(payments.length).toBe(1);

    const paidEvents = await prisma.domainEvent.count({ where: { orderId: created.orderId, type: "ORDER_PAID" } });
    const ticketsEvents = await prisma.domainEvent.count({ where: { orderId: created.orderId, type: "TICKETS_ISSUED" } });
    expect(paidEvents).toBe(1);
    expect(ticketsEvents).toBe(1);
  });
});
