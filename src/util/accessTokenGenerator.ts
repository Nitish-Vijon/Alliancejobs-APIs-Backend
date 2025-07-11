import jwt from "jsonwebtoken";
import { config } from "../lib/config";

export const accessTokenGenerator = (
  id: string | number,
  email: string,
  userType: string
) => {
  return jwt.sign({ id, email, userType }, config.access_key as string);
};
