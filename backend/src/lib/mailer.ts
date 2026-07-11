import type { Transporter } from "nodemailer";

export async function sendOtpEmail(
  transporter: Pick<Transporter, "sendMail">,
  to: string,
  otp: string
): Promise<void> {
  await transporter.sendMail({
    from: "FeastNow <no-reply@feastnow.app>",
    to,
    subject: "Your FeastNow verification code",
    text: `Your FeastNow verification code is ${otp}. It expires in 10 minutes.`,
  });
}
