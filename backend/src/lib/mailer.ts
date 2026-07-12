export interface OtpEmailClient {
  emails: {
    send: (opts: {
      from: string;
      to: string | string[];
      subject: string;
      text: string;
    }) => Promise<{ data: unknown; error: unknown }>;
  };
}

export async function sendOtpEmail(
  client: OtpEmailClient,
  from: string,
  to: string,
  otp: string
): Promise<void> {
  const { error } = await client.emails.send({
    from,
    to,
    subject: "Your FeastNow verification code",
    text: `Your FeastNow verification code is ${otp}. It expires in 10 minutes.`,
  });
  if (error) {
    throw new Error(`Failed to send OTP email via Resend: ${JSON.stringify(error)}`);
  }
}
