import axios from "axios";
import { config } from "../lib/config";

export const sendOTP = async (phone: string, otp: string): Promise<boolean> => {
  try {
    const message = `Hello, Your OTP is ${otp} for Alliance Jobs Login. Please use this within 5 min utes and do not share it with anyone. Alliance Jobs`;

    // Using Cohere's generate endpoint to format and send SMS
    const response = await axios.post(
      `https://103.229.250.200/smpp/sendsms?username=${config.otp_username}&password=${config.otp_password}&to=${phone}&from=${config.otp_sender}&text=${message}`
    );

    console.log("API Response: =====>", response);
    return true;
  } catch (error) {
    console.error("Error sending SMS via Cohere:", error);
    return false;
  }
};
