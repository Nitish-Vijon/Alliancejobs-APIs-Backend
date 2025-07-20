import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  cohere_api_Key: process.env.COHERE_API_KEY,
  access_key: process.env.ACCESS_TOKEN_SECRET,
  otp_username: process.env.OTP_USERNAME,
  otp_password: process.env.OTP_PASSWORD,
  otp_sender: process.env.OTP_SENDER,
  gemini_api_key: process.env.GEMINI_API_KEY,
};

export const mustload = () => {
  // Convert config object to array of key-value pairs
  const configArray = Object.entries(config);

  const missingConfigs = [];

  // Check each configuration
  configArray.forEach(([key, value]) => {
    if (key === "port") return;

    if (!value || value === "") {
      missingConfigs.push(key);
    }
  });

  // If any configurations are missing, show error and exit
  if (missingConfigs.length > 0) {
    console.error("Server startup failed - Missing required configuration(s):");
    console.error("");

    missingConfigs.forEach((configName) => {
      const envVarName = configName.replace(/([A-Z])/g, "_$1").toUpperCase();
      console.error(`${configName} (Environment variable: ${envVarName})`);
    });

    console.error("");
    console.error(
      "Please ensure all required environment variables are set in your .env file."
    );
    console.error("");

    // Exit the process
    process.exit(1);
  }

  console.log("All required configurations loaded successfully");
};
