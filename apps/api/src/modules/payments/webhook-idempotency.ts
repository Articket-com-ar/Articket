import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type ClaimProviderEventInput = {
  provider: string;
  providerEventId: string;
  payloadHash: string;
  orderId?: string;
  leaseSeconds?: number;
};

type ClaimProviderEventResult =
  | { state: "claimed"; mode: "new" | "retry" }
  | { state: "deduped" }
  | { state: "in_flight" };

export async function claimProviderEvent(input: ClaimProviderEventInput): Promise<ClaimProviderEventResult> {
  const now = new Date();
  const leaseSeconds = input.leaseSeconds ?? 30;
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);

  try {
    await prisma.paymentProviderEvent.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        payloadHash: input.payloadHash,
        orderId: input.orderId,
        status: "processing",
        attempts: 1,
        lastAttemptAt: now,
        leaseUntil
      }
    });
    return { state: "claimed", mode: "new" };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }

  const existing = await prisma.paymentProviderEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId
      }
    },
    select: {
      status: true,
      leaseUntil: true
    }
  });

  if (!existing) {
    return { state: "in_flight" };
  }

  if (existing.status === "processed") {
    return { state: "deduped" };
  }

  const leaseActive = existing.status === "processing" && !!existing.leaseUntil && existing.leaseUntil > now;
  if (leaseActive) {
    return { state: "in_flight" };
  }

  const claim = await prisma.paymentProviderEvent.updateMany({
    where: {
      provider: input.provider,
      providerEventId: input.providerEventId,
      OR: [
        { status: "received" },
        { status: "error" },
        { status: "processing", leaseUntil: { lte: now } }
      ]
    },
    data: {
      status: "processing",
      leaseUntil,
      lastAttemptAt: now,
      attempts: { increment: 1 },
      errorMessage: null,
      ...(input.orderId ? { orderId: input.orderId } : {})
    }
  });

  if (claim.count === 0) {
    return { state: "in_flight" };
  }

  return { state: "claimed", mode: "retry" };
}

export async function markProviderEventProcessed(provider: string, providerEventId: string, orderId?: string) {
  await prisma.paymentProviderEvent.updateMany({
    where: { provider, providerEventId },
    data: {
      status: "processed",
      processedAt: new Date(),
      leaseUntil: null,
      ...(orderId ? { orderId } : {})
    }
  });
}

export async function markProviderEventError(provider: string, providerEventId: string, errorMessage: string) {
  await prisma.paymentProviderEvent.updateMany({
    where: { provider, providerEventId },
    data: {
      status: "error",
      leaseUntil: null,
      errorMessage: errorMessage.slice(0, 1000)
    }
  });
}
