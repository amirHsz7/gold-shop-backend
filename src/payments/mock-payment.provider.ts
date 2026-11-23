
import { randomUUID } from "node:crypto";
import { AppError } from "../utils/app-error.js";
import type {
  PaymentProvider,
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "./payment-provider.js";

interface MockCallbackPayload {
  outcome: "success" | "failed";
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  private assertDevelopmentEnvironment() {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Mock payment is disabled in production.",
        403,
      );
    }
  }

  async createPaymentSession(
    input: CreatePaymentSessionInput,
  ): Promise<CreatePaymentSessionResult> {
    this.assertDevelopmentEnvironment();

    if (new Date() >= input.expiresAt) {
      throw new AppError("مهلت پرداخت سفارش به پایان رسیده است.", 409);
    }

    const authority = randomUUID();

    return {
      authority,
      checkoutUrl: `/payments/mock/${authority}`,
    };
  }

  async verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    this.assertDevelopmentEnvironment();

    const payload = input.payload as Partial<MockCallbackPayload> | null;

    if (
      !payload ||
      (payload.outcome !== "success" && payload.outcome !== "failed")
    ) {
      throw new AppError("اطلاعات پرداخت آزمایشی معتبر نیست.", 400);
    }

    if (!input.authority) {
      throw new AppError("شناسه پرداخت معتبر نیست.", 400);
    }

    if (payload.outcome === "failed") {
      return {
        success: false,
        refId: null,
        cardPan: null,
        failureReason: "MOCK_PAYMENT_FAILED",
      };
    }

    return {
      success: true,
      refId: `MOCK-${randomUUID()}`,
      cardPan: null,
      failureReason: null,
    };
  }
}
