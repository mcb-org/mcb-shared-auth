import jwt from "jsonwebtoken";
import type { TUser } from "../types";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config";

export const signToken = (user: TUser) => {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    JWT_SECRET!,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    },
  );
};
