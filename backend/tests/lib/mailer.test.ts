import { describe, it, expect, vi } from "vitest";
import { createBrevoOtpEmailSender, parseSender } from "../../src/lib/mailer";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

describe("createBrevoOtpEmailSender", () => {
  it("sends the otp code, expiry, sender and recipient via the Brevo API", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => "" });
    const sender = createBrevoOtpEmailSender("k", "FeastNow <no-reply@feastnow.app>", fetchFn);

    await sender.send("customer@example.com", "482913");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(BREVO_SEND_URL);
    expect(init.headers["api-key"]).toBe("k");

    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: "FeastNow", email: "no-reply@feastnow.app" });
    expect(body.to).toEqual([{ email: "customer@example.com" }]);
    expect(body.textContent).toContain("482913");
    expect(body.textContent).toContain("10 minutes");
  });

  it("throws when Brevo returns a non-ok response (so a failed send is never silent)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" });
    const sender = createBrevoOtpEmailSender("k", "from@x.com", fetchFn);

    await expect(sender.send("to@x.com", "123456")).rejects.toThrow();
  });
});

describe("parseSender", () => {
  it("parses a bare email address", () => {
    expect(parseSender("no-reply@feastnow.app")).toEqual({ name: "FeastNow", email: "no-reply@feastnow.app" });
  });

  it("parses a 'Name <email>' sender", () => {
    expect(parseSender("FeastNow <no-reply@feastnow.app>")).toEqual({ name: "FeastNow", email: "no-reply@feastnow.app" });
  });
});
