interface ResponseHandlerOptions {
  message: string;
  data?: any;
  status?: number;
  meta?: any; // Optional: for pagination or additional context
}

export class ResponseHandler {
  public status: number;
  public success: boolean;
  public message: string;
  public data: any;
  public meta?: any;
  public timestamp: string;

  constructor({
    message,
    data = {},
    status = 200,
    meta,
  }: ResponseHandlerOptions) {
    this.status = status;
    this.success = true;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      status: this.status,
      success: this.success,
      message: this.message,
      data: this.data,
      ...(this.meta && { meta: this.meta }),
      timestamp: this.timestamp,
    };
  }
}
