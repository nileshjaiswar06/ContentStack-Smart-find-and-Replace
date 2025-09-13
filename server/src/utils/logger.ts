import winston from "winston";

const winstonLogger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    // Include requestId if provided on the log info object
    winston.format.printf((info) => {
      const { level, message, timestamp, requestId } = info as any;
      const reqId = requestId || (info.meta && (info.meta as any).requestId) || undefined;
      const idPart = reqId ? ` [req:${reqId}]` : "";
      // If message is an object, stringify it safely
      const msg = typeof message === 'string' ? message : JSON.stringify(message);
      return `${timestamp} ${level}:${idPart} ${msg}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Lightweight wrapper to accept requestId and meta
const logger = {
  info: (msg: any, requestIdOrMeta?: any, maybeMeta?: Record<string, any>) => {
    let requestId: string | undefined;
    let meta: Record<string, any> | undefined;
    if (typeof requestIdOrMeta === 'string') {
      requestId = requestIdOrMeta;
      meta = maybeMeta;
    } else {
      meta = requestIdOrMeta;
    }
    winstonLogger.info(msg, { requestId, ...meta });
  },
  warn: (msg: any, requestIdOrMeta?: any, maybeMeta?: Record<string, any>) => {
    let requestId: string | undefined;
    let meta: Record<string, any> | undefined;
    if (typeof requestIdOrMeta === 'string') {
      requestId = requestIdOrMeta;
      meta = maybeMeta;
    } else {
      meta = requestIdOrMeta;
    }
    winstonLogger.warn(msg, { requestId, ...meta });
  },
  error: (msg: any, requestIdOrMeta?: any, maybeMeta?: Record<string, any>) => {
    let requestId: string | undefined;
    let meta: Record<string, any> | undefined;
    if (typeof requestIdOrMeta === 'string') {
      requestId = requestIdOrMeta;
      meta = maybeMeta;
    } else {
      meta = requestIdOrMeta;
    }
    winstonLogger.error(msg, { requestId, ...meta });
  },
  debug: (msg: any, requestIdOrMeta?: any, maybeMeta?: Record<string, any>) => {
    let requestId: string | undefined;
    let meta: Record<string, any> | undefined;
    if (typeof requestIdOrMeta === 'string') {
      requestId = requestIdOrMeta;
      meta = maybeMeta;
    } else {
      meta = requestIdOrMeta;
    }
    winstonLogger.debug(msg, { requestId, ...meta });
  },
  // expose raw logger if needed
  raw: winstonLogger
};

export { logger };
export default logger;
