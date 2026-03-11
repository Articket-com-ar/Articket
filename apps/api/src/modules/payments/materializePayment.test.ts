import { beforeEach, describe, expect, it, vi } from "vitest";

const tx: any = {
  payment: {
    findUnique: vi.fn(),
    create: vi.fn()
  }
};

describe("materializePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.payment.findUnique.mockResolvedValue(null);
    tx.payment.create.mockImplementation(async ({ data }: any) => ({ id: "p-created", ...data }));
  });

  it("creates canonical payment when it does not exist", async () => {
    const { materializePayment } = await import("./materializePayment.js");

    const result = await materializePayment(tx, {
      orderId: "o1",
      provider: "mock",
      providerRef: "pay-1",
      amountCents: 1000,
      status: "paid"
    });

    expect(result).toEqual({ state: "created", paymentId: "p-created" });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: "o1",
        provider: "mock",
        providerRef: "pay-1",
        status: "paid",
        amountCents: 1000
      }
    });
  });

  it("returns existing canonical payment for equivalent replay", async () => {
    tx.payment.findUnique.mockResolvedValueOnce({ id: "p-existing", orderId: "o1", provider: "mock", providerRef: "pay-1" });
    const { materializePayment } = await import("./materializePayment.js");

    const result = await materializePayment(tx, {
      orderId: "o1",
      provider: "mock",
      providerRef: "pay-1",
      amountCents: 1000,
      status: "paid"
    });

    expect(result).toEqual({ state: "existing", paymentId: "p-existing" });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("raises explicit conflict when reference is already bound to another order", async () => {
    tx.payment.findUnique.mockResolvedValueOnce({ id: "p-other", orderId: "o-other", provider: "mock", providerRef: "pay-1" });
    const { materializePayment } = await import("./materializePayment.js");

    await expect(materializePayment(tx, {
      orderId: "o1",
      provider: "mock",
      providerRef: "pay-1",
      amountCents: 1000,
      status: "paid"
    })).rejects.toMatchObject({ code: "PAYMENT_REFERENCE_ALREADY_USED", statusCode: 409 });
  });
});
