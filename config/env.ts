import "dotenv/config";
const NODE_ENV = process.env.NODE_ENV;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export { NODE_ENV, JWT_SECRET, JWT_EXPIRES_IN, GITHUB_TOKEN };
