import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
  max: 100, // 100 requests
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: "Too many requests from this IP, please try again in an hour!", // message to send
});
