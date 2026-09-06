import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import FormField from "../components/FormField";
import PrimaryButton from "../components/PrimaryButton";
import AlertBanner from "../components/AlertBanner";
import authService from "../services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [error, setError] = useState(null); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  async function submit(event) { event.preventDefault(); setError(null); setLoading(true); try { await authService.forgotPassword(email); setSent(true); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <AuthLayout title="Reset your password" description="Enter your email and we will send a recovery link if an account exists."><form onSubmit={submit} className="flex flex-col gap-4"><AlertBanner message={error}/><AlertBanner message={sent ? "If that account exists, a recovery link has been sent." : null} variant="success"/><FormField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} /><PrimaryButton isLoading={loading} loadingText="Sending…">Send recovery link</PrimaryButton><p className="text-center text-sm text-muted"><Link to="/login" className="text-accent hover:underline">Back to sign in</Link></p></form></AuthLayout>;
}
