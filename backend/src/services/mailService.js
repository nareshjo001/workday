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
  const path = purpose === "PASSWORD_RESET" ? "reset-password" : purpose === "PM_COMPANY_INVITATION" ? "signup" : "setup-password";
  const subject = purpose === "PASSWORD_RESET" ? "Reset your VMS password" : purpose === "PM_COMPANY_INVITATION" ? "Join your client company in VMS" : "Set up your VMS account";
  const text = purpose === "PM_COMPANY_INVITATION"
    ? `Hello ${name},\n\nYou have been invited to join a client company as a Project Manager. Create your PM account using this one-time invitation link: ${env.mail.publicUrl}/${path}?companyInvitationToken=${encodeURIComponent(token)}\n\nIf you did not expect this invitation, you can ignore this email.`
    : `Hello ${name},\n\nUse this one-time link: ${env.mail.publicUrl}/${path}?token=${encodeURIComponent(token)}\n\nIf you did not request this, you can ignore this email.`;
  await send({ to, purpose, subject, text });
}
function getOutbox() { return [...outbox]; }
function clearOutbox() { outbox.length = 0; }
function status() { return env.mail.smtpHost ? "configured" : "outbox"; }
module.exports = { sendAction, getOutbox, clearOutbox, status };
