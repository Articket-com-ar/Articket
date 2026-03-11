import type { Prisma } from "@prisma/client";

type PaymentDb = Prisma.TransactionClient;

type MaterializePaymentInput = {
  orderId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
  status?: string;
};

type MaterializePaymentResult =
  | { state: "created"; paymentId: string }
  | { state: "existing"; paymentId: string };

export async function materializePayment(
  tx: PaymentDb,
  input: MaterializePaymentInput
): Promise<MaterializePaymentResult> {
  const existing = await tx.payment.findUnique({
    where: {
      provider_providerRef: {
        provider: input.provider,
        providerRef: input.providerRef
      }
    }
  });

  if (existing) {
    if (existing.orderId !== input.orderId) {
      const conflictError: Error & { statusCode?: number; code?: string } = new Error("Payment reference already used");
      conflictError.statusCode = 409;
      conflictError.code = "PAYMENT_REFERENCE_ALREADY_USED";
      throw conflictError;
    }

    return { state: "existing", paymentId: existing.id };
  }

  const created = await tx.payment.create({
    data: {
      orderId: input.orderId,
      provider: input.provider,
      providerRef: input.providerRef,
      status: input.status ?? "paid",
      amountCents: input.amountCents
    }
  });

  return { state: "created", paymentId: created.id };
}
