import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { hasIntegrationEnv } from "./integrationTestEnv.js";

if (!process.env.API_PORT) process.env.API_PORT = "3422";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-min-24-ch";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-24-ch";
process.env.QR_SECRET ||= "test-qr-secret-min-24-ch";
process.env.PAYMENTS_WEBHOOK_SECRET ||= "test-webhook-secret-min-24-ch";
process.env.NODE_ENV ||= "test";

const baseUrl = `http://127.0.0.1:${process.env.API_PORT}`;
const provider = "mock";

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not become healthy in time");
}

describe.skipIf(!hasIntegrationEnv)("payment convergence between confirm and webhook", () => {
  const created: {
    organizerIds: string[];
    eventIds: string[];
    ticketTypeIds: string[];
    orderIds: string[];
    providerEventIds: string[];
  } = {
    organizerIds: [],
    eventIds: [],
    ticketTypeIds: [],
    orderIds: [],
    providerEventIds: []
  };

  beforeAll(async () => {
    await import("../../server.js");
    await waitForHealth();
  });

  afterAll(async () => {
    if (created.orderIds.length === 0) return;

    await prisma.confirmIdempotencyKey.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.domainEvent.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.ticketScan.deleteMany({ where: { eventId: { in: created.eventIds } } });
    await prisma.ticket.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.paymentEvent.deleteMany({ where: { provider, providerEventId: { in: created.providerEventIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
    await prisma.ticketType.deleteMany({ where: { id: { in: created.ticketTypeIds } } });
    await prisma.event.deleteMany({ where: { id: { in: created.eventIds } } });
    await prisma.organizer.deleteMany({ where: { id: { in: created.organizerIds } } });
  });

  async function seedOrder(status: "reserved" | "pending" = "reserved") {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const organizer = await prisma.organizer.create({
      data: {
        name: `Conv Org ${suffix}`,
        slug: `conv-org-${suffix}`,
        serviceFeeBps: 0,
        taxBps: 0
      }
    });

    const event = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        name: `Conv Event ${suffix}`,
        slug: `conv-event-${suffix}`,
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
        priceCents: 1500,
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
        customerEmail: `conv-${suffix}@test.local`,
        status,
        orderNumber: `CNV-${suffix}`,
        subtotalCents: 1500,
        totalCents: 1500,
        feeCents: 0,
        taxCents: 0,
        reservedUntil: new Date(Date.now() + 10 * 60 * 1000),
        items: {
          create: [{
            ticketTypeId: ticketType.id,
            quantity: 1,
            unitPriceCents: 1500,
            totalCents: 1500
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

    created.organizerIds.push(organizer.id);
    created.eventIds.push(event.id);
    created.ticketTypeIds.push(ticketType.id);
    created.orderIds.push(order.id);

    return { organizer, event, ticketType, order };
  }

  async function getCounts(orderId: string) {
    const [payments, order, paidEvents, ticketsEvents, tickets] = await Promise.all([
      prisma.payment.findMany({ where: { orderId } }),
      prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
      prisma.domainEvent.count({ where: { orderId, type: "ORDER_PAID" } }),
      prisma.domainEvent.count({ where: { orderId, type: "TICKETS_ISSUED" } }),
      prisma.ticket.count({ where: { orderId } })
    ]);

    return { payments, order, paidEvents, ticketsEvents, tickets };
  }

  it("1) webhook paid con providerPaymentId válido => crea Payment y aplica efectos", async () => {
    const seeded = await seedOrder();
    const providerEventId = `evt-valid-${Date.now()}`;
    created.providerEventIds.push(providerEventId);

    const response = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: {
          id: `pay-${Date.now()}`,
          metadata: { orderId: seeded.order.id }
        }
      })
    });

    expect(response.status).toBe(200);

    const { payments, order, paidEvents, ticketsEvents, tickets } = await getCounts(seeded.order.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].providerRef).toMatch(/^pay-/);
    expect(order.status).toBe("paid");
    expect(paidEvents).toBe(1);
    expect(ticketsEvents).toBe(1);
    expect(tickets).toBe(1);
  });

  it("2) webhook paid sin providerPaymentId => no crea Payment ni paid ni tickets; paymentEvent queda no procesado con error", async () => {
    const seeded = await seedOrder();
    const providerEventId = `evt-missing-${Date.now()}`;
    created.providerEventIds.push(providerEventId);

    const response = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: {
          metadata: { orderId: seeded.order.id }
        }
      })
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("MISSING_PAYMENT_IDENTITY");

    const { payments, order, paidEvents, ticketsEvents, tickets } = await getCounts(seeded.order.id);
    expect(payments).toHaveLength(0);
    expect(order.status).toBe("reserved");
    expect(paidEvents).toBe(0);
    expect(ticketsEvents).toBe(0);
    expect(tickets).toBe(0);

    const paymentEvent = await prisma.paymentEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider, providerEventId } }
    });
    expect(paymentEvent.processedAt).toBeNull();
    expect(paymentEvent.processError).toContain("providerPaymentId required for paid webhook");
  });

  it("3) webhook primero, confirm después con misma identidad fuerte => un solo Payment", async () => {
    const seeded = await seedOrder();
    const strongRef = `same-${Date.now()}-3`;
    const providerEventId = `evt-same-${Date.now()}-3`;
    created.providerEventIds.push(providerEventId);

    const webhook = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: seeded.order.id } }
      })
    });
    expect(webhook.status).toBe(200);

    const confirm = await fetch(`${baseUrl}/checkout/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientRequestId: `crid-${Date.now()}-3`,
        orderId: seeded.order.id,
        paymentReference: strongRef
      })
    });
    expect(confirm.status).toBe(200);

    const { payments, order, paidEvents, ticketsEvents, tickets } = await getCounts(seeded.order.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].providerRef).toBe(strongRef);
    expect(order.status).toBe("paid");
    expect(paidEvents).toBe(1);
    expect(ticketsEvents).toBe(1);
    expect(tickets).toBe(1);
  });

  it("4) confirm primero, webhook después con misma identidad fuerte => un solo Payment", async () => {
    const seeded = await seedOrder();
    const strongRef = `same-${Date.now()}-4`;
    const providerEventId = `evt-same-${Date.now()}-4`;
    created.providerEventIds.push(providerEventId);

    const confirm = await fetch(`${baseUrl}/checkout/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientRequestId: `crid-${Date.now()}-4`,
        orderId: seeded.order.id,
        paymentReference: strongRef
      })
    });
    expect(confirm.status).toBe(200);

    const webhook = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: seeded.order.id } }
      })
    });
    expect(webhook.status).toBe(200);

    const { payments, order, paidEvents, ticketsEvents, tickets } = await getCounts(seeded.order.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].providerRef).toBe(strongRef);
    expect(order.status).toBe("paid");
    expect(paidEvents).toBe(1);
    expect(ticketsEvents).toBe(1);
    expect(tickets).toBe(1);
  });

  it("5) misma entrada webhook repetida => no duplica Payment, ORDER_PAID ni tickets", async () => {
    const seeded = await seedOrder();
    const strongRef = `same-${Date.now()}-5`;
    const providerEventId = `evt-same-${Date.now()}-5`;
    created.providerEventIds.push(providerEventId);

    const first = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: seeded.order.id } }
      })
    });

    const second = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: seeded.order.id } }
      })
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const secondBody = await second.json();
    expect(secondBody.deduped).toBe(true);

    const { payments, paidEvents, ticketsEvents, tickets } = await getCounts(seeded.order.id);
    expect(payments).toHaveLength(1);
    expect(paidEvents).toBe(1);
    expect(ticketsEvents).toBe(1);
    expect(tickets).toBe(1);
  });

  it("6) misma referencia fuerte usada por otra orden => conflicto explícito", async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const strongRef = `same-${Date.now()}-6`;
    const firstEventId = `evt-same-${Date.now()}-6-a`;
    const secondEventId = `evt-same-${Date.now()}-6-b`;
    created.providerEventIds.push(firstEventId, secondEventId);

    const first = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: firstEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: a.order.id } }
      })
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${baseUrl}/webhooks/payments/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: secondEventId,
        type: "payment.succeeded",
        data: { id: strongRef, metadata: { orderId: b.order.id } }
      })
    });
    expect(second.status).toBe(409);

    const { payments: paymentsA } = await getCounts(a.order.id);
    const { payments: paymentsB, order: orderB, paidEvents: paidEventsB, tickets: ticketsB } = await getCounts(b.order.id);
    expect(paymentsA).toHaveLength(1);
    expect(paymentsB).toHaveLength(0);
    expect(orderB.status).toBe("reserved");
    expect(paidEventsB).toBe(0);
    expect(ticketsB).toBe(0);
  });
});
