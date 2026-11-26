export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: {
      code: string;
      data: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AppError";
  }
}