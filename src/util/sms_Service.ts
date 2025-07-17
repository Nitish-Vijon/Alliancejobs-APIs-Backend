import { config } from "../lib/config";

export class CohereOTPService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.cohere_api_Key || process.env.COHERE_API_KEY || "";
    this.baseUrl = "https://api.cohere.ai/v1";

    if (!this.apiKey) {
      throw new Error("COHERE_API_KEY is not configured");
    }
  }

  async sendOTP(phone: string, otp: string): Promise<boolean> {
    try {
      const message = `Your OTP is: ${otp}. Valid for 5 minutes. Do not share with anyone.`;

      // Using Cohere's generate endpoint to format and send SMS
      const response = await fetch(
        `https://103.229.250.200/smpp/sendsms?username=allgrw&password=sms@2023&to=${phone}&from=Alliance&text=${message}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Cohere API Error:", errorData);
        return false;
      }

      await response.json();
      return true;
    } catch (error) {
      console.error("Error sending SMS via Cohere:", error);
      return false;
    }
  }
}
