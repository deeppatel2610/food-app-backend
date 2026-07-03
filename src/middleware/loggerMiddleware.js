const morgan = require("morgan");

/**
 * Custom request logger to print incoming API calls, method, URL, status code, and response time in terminal.
 */
const requestLogger = morgan((tokens, req, res) => {
  const status = tokens.status(req, res);
  const statusColor =
    status >= 500
      ? "\x1b[31m" // Red for Server Errors
      : status >= 400
      ? "\x1b[33m" // Yellow for Client Errors
      : status >= 300
      ? "\x1b[36m" // Cyan for Redirects
      : "\x1b[32m"; // Green for Success

  const resetColor = "\x1b[0m";
  const methodColor = "\x1b[35m"; // Magenta for HTTP Method

  return [
    `[${new Date().toLocaleTimeString()}]`,
    `${methodColor}${tokens.method(req, res)}${resetColor}`,
    tokens.url(req, res),
    `${statusColor}${status}${resetColor}`,
    `- ${tokens["response-time"](req, res)} ms`,
  ].join(" ");
});

module.exports = {
  requestLogger,
};
