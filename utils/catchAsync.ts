import type { Request, Response, NextFunction } from "express";
import type { TAsyncFunction } from "../types";

export const catchAsync = (func: TAsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    func(req, res, next).catch(next);
  };
};
