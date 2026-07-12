type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface OtpEmailSender {
  send(to: string, otp: string): Promise<void>;
}

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

/** Parses 'Name <email@x>' or a bare 'email@x' into Brevo's sender shape. */
export function parseSender(emailFrom: string): { name: string; email: string } {
  const match = emailFrom.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (match) return { name: match[1] || "FeastNow", email: match[2] };
  return { name: "FeastNow", email: emailFrom.trim() };
}

export function createBrevoOtpEmailSender(
  apiKey: string,
  emailFrom: string,
  fetchFn: FetchLike = fetch
): OtpEmailSender {
  const sender = parseSender(emailFrom);
  return {
    async send(to, otp) {
      const res = await fetchFn(BREVO_SEND_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject: "Your FeastNow verification code",
          textContent: `Your FeastNow verification code is ${otp}. It expires in 10 minutes.`,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Failed to send OTP email via Brevo: ${res.status} ${detail}`);
      }
    },
  };
}
