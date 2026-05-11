class ApiError extends Error {
  constructor(statusCode, message, errorData = null) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errorData = errorData;
  }
}

module.exports = ApiError;
