export interface OpenAIErrorPayload {
  error: {
    message: string;
    type: string;
    param?: string | null;
    code?: string | null;
  };
}

export class OmniRouterError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;
  public readonly errorCode?: string | null;
  public readonly param?: string | null;

  constructor(
    message: string,
    statusCode = 500,
    errorType = "api_error",
    errorCode: string | null = null,
    param: string | null = null
  ) {
    super(message);
    this.name = "OmniRouterError";
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.errorCode = errorCode;
    this.param = param;
  }

  toJSON(): OpenAIErrorPayload {
    return {
      error: {
        message: this.message,
        type: this.errorType,
        param: this.param ?? null,
        code: this.errorCode ?? null,
      },
    };
  }
}

export class AuthenticationError extends OmniRouterError {
  constructor(message = "Incorrect or missing API key provided.", code = "invalid_api_key") {
    super(message, 401, "authentication_error", code);
  }
}

export class ModelNotFoundError extends OmniRouterError {
  constructor(modelId: string) {
    super(`The model '${modelId}' does not exist or you do not have access to it.`, 404, "invalid_request_error", "model_not_found");
  }
}

export class BadRequestError extends OmniRouterError {
  constructor(message: string, param?: string | null) {
    super(message, 400, "invalid_request_error", null, param);
  }
}

export class UpstreamError extends OmniRouterError {
  constructor(message: string, statusCode = 502, code: string | null = null) {
    super(message, statusCode, "api_error", code);
  }
}
