export function notFoundHandler(_req, res) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Endpoint not found",
    version: "v1",
  });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  console.error(`[API] ${status} ${code}:`, err.message);
  res.status(status).json({
    error: code,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
