import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  cohere_api_Key: process.env.COHERE_API_KEY,
  access_key: process.env.ACCESS_TOKEN_SECRET,
};
