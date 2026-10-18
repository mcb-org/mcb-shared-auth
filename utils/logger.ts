import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import { NODE_ENV } from "../config";

// create logger with a daily rotate file transport with proper type and generics if needed
export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.json(),
  ),
  transports: [
    new transports.DailyRotateFile({
      filename: "logs/error/%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      level: "error",
    }),
    new transports.DailyRotateFile({
      filename: "logs/%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// Containers are expected to log to stdout: files inside a container are lost
// when it is replaced and invisible to `docker logs` and log shippers. The
// files above are kept for hosts that are not containerised.
if (NODE_ENV === "production") {
  logger.add(new transports.Console({ format: format.json() }));
}

if (NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
      ),
      level: "debug",
    }),
  );
}
