/**
 * Standardized Common API Response Handler
 */

const toCamel = (str) => {
  return str.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

const isObject = (obj) => {
  return obj !== null &&
         typeof obj === 'object' &&
         !Array.isArray(obj) &&
         !(obj instanceof Date) &&
         !(obj instanceof RegExp) &&
         !Buffer.isBuffer(obj);
};

const keysToCamel = (obj) => {
  if (isObject(obj)) {
    const n = {};
    Object.keys(obj).forEach((k) => {
      n[toCamel(k)] = keysToCamel(obj[k]);
    });
    return n;
  } else if (Array.isArray(obj)) {
    return obj.map((i) => {
      return keysToCamel(i);
    });
  }
  return obj;
};

const sendResponse = (res, statusCode, success, message, data = null, error = null) => {
  const responseObj = {
    success,
    message,
  };

  if (data !== null) responseObj.data = keysToCamel(data);
  if (error !== null) responseObj.error = keysToCamel(error);
  responseObj.timestamp = new Date().toISOString();

  return res.status(statusCode).json(responseObj);
};

const sendSuccess = (res, message, data = null, statusCode = 200) => {
  return sendResponse(res, statusCode, true, message, data);
};

const sendError = (res, message, error = null, statusCode = 500) => {
  return sendResponse(res, statusCode, false, message, null, error);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendError,
};
