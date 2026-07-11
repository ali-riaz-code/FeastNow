import bcrypt from "bcryptjs";

const OTP_BCRYPT_COST = 10;

export function generateOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_COST);
}

export async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
