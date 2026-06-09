export class AppError extends Error {
  statusCode: number;
  status: "fail" | "error";
  isOperational: boolean;
  errmsg?: string;
  code?: number;
  errors?: Record<string, unknown>;
  path?: string;
  value?: string | number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errmsg = message;
    this.code = statusCode;
  }
}
