import { describe, it, expect, vi } from "vitest";
import { sendOtpEmail } from "../../src/lib/mailer";

describe("sendOtpEmail", () => {
  it("sends the otp code and expiry in the message text", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    await sendOtpEmail({ sendMail }, "customer@example.com", "482913");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe("customer@example.com");
    expect(message.text).toContain("482913");
    expect(message.text).toContain("10 minutes");
  });
});
