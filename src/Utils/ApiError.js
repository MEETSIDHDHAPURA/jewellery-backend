class ApiError extends Error {
  constructor(statusCode, message, errorData = null) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errorData = errorData;

    Object.defineProperty(this, "message", {
      value: message,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
}

module.exports = ApiError;
