const nodemailer = require("nodemailer");
const env = require("../config/env");
const outbox = [];

function transport() {
  if (!env.mail.smtpHost) return null;
  return nodemailer.createTransport({ host: env.mail.smtpHost, port: env.mail.smtpPort, secure: env.mail.smtpPort === 465, auth: env.mail.smtpUser ? { user: env.mail.smtpUser, pass: env.mail.smtpPassword } : undefined });
}
async function send({ to, subject, text, purpose }) {
  const message = { from: env.mail.from, to, subject, text };
  const smtp = transport();
  if (!smtp) { outbox.push({ ...message, purpose }); return; }
  await smtp.sendMail(message);
}
async function sendAction({ to, name, purpose, token }) {
  const path = purpose === "PASSWORD_RESET" ? "reset-password" : "setup-password";
  await send({ to, purpose, subject: purpose === "PASSWORD_RESET" ? "Reset your VMS password" : "Set up your VMS account", text: `Hello ${name},\n\nUse this one-time link: ${env.mail.publicUrl}/${path}?token=${encodeURIComponent(token)}\n\nIf you did not request this, you can ignore this email.` });
}
function getOutbox() { return [...outbox]; }
function clearOutbox() { outbox.length = 0; }
function status() { return env.mail.smtpHost ? "configured" : "outbox"; }
module.exports = { sendAction, getOutbox, clearOutbox, status };
