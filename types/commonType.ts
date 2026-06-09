import type { Request, Response, NextFunction } from "express";

export type TAsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export type TGenerateSKU = (length: number) => string;
