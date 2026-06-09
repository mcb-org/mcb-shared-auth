import bcryptjs from "bcryptjs";

// compare password from request with the one in the database
export const comparePassword = (password: string, userPassword: string) => {
  return bcryptjs.compareSync(password, userPassword);
};
