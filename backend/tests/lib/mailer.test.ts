import { describe, it, expect, vi } from "vitest";
import { sendOtpEmail } from "../../src/lib/mailer";

describe("sendOtpEmail (Resend)", () => {
  it("sends the otp code, expiry, sender and recipient", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "email_1" }, error: null });
    await sendOtpEmail({ emails: { send } }, "FeastNow <no-reply@feastnow.app>", "customer@example.com", "482913");
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe("FeastNow <no-reply@feastnow.app>");
    expect(msg.to).toBe("customer@example.com");
    expect(msg.text).toContain("482913");
    expect(msg.text).toContain("10 minutes");
  });

  it("throws when Resend returns an error (so a failed send is never silent)", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await expect(
      sendOtpEmail({ emails: { send } }, "from@x.com", "to@x.com", "123456")
    ).rejects.toThrow();
  });
});
