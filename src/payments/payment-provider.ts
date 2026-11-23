
export interface CreatePaymentSessionInput {
  paymentId: string;
  amount: string;
  expiresAt: Date;
}

export interface CreatePaymentSessionResult {
  authority: string;
  checkoutUrl: string;
}

export interface VerifyPaymentInput {
  authority: string;
  payload: unknown;
}

export interface VerifyPaymentResult {
  success: boolean;
  refId: string | null;
  cardPan: string | null;
  failureReason: string | null;
}

export interface PaymentProvider {
  readonly name: string;

  createPaymentSession(
    input: CreatePaymentSessionInput,
  ): Promise<CreatePaymentSessionResult>;

  verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult>;
}
