class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  data?: unknown;

  constructor(statusCode: number, message: string, data?: unknown, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.data = data;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
