import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  BRIDGE_PORT: Number(process.env.BRIDGE_PORT) || 4142,
  GATEWAY_PORT: Number(process.env.GATEWAY_PORT) || 9080,
  GATEWAY_HOST: process.env.GATEWAY_HOST || "127.0.0.1",
  DEEPSEEK_URL: "https://chat.deepseek.com",
  PROFILE_PATH: process.env.DEEPSEEK_PROFILE_PATH || "/home/ultraclaude/.deepseek-worker/profile",
  HEADLESS: process.env.HEADLESS !== 'false',
  CREDENTIALS: {
    username: process.env.DEEPSEEK_USERNAME || "james.gonzales.1985@gmail.com",
    password: process.env.DEEPSEEK_PASSWORD || "batmanbegins"
  }
};
