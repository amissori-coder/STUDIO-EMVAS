import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export function isMailerConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }) {
  if (!isMailerConfigured()) return false;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("[mailer] invio fallito:", e);
    return false;
  }
}
