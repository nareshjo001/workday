import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import PasswordField from "../components/PasswordField";
import PrimaryButton from "../components/PrimaryButton";
import AlertBanner from "../components/AlertBanner";
import authService from "../services/authService";

export default function PasswordActionPage({ mode }) {
  const [params] = useSearchParams(); const [password,setPassword]=useState(""); const [error,setError]=useState(null); const [done,setDone]=useState(false); const [loading,setLoading]=useState(false); const token=params.get("token") || "";
  async function submit(event) { event.preventDefault(); if(password.length < 8) { setError("Password must be at least 8 characters."); return; } setError(null); setLoading(true); try { if(mode === "reset") await authService.resetPassword(token,password); else await authService.setupPassword(token,password); setDone(true); } catch(err) { setError(err.message); } finally { setLoading(false); } }
  const title = mode === "reset" ? "Choose a new password" : "Set up your account";
  return <AuthLayout title={title} description="This one-time link expires soon."><form onSubmit={submit} className="flex flex-col gap-4"><AlertBanner message={error}/><AlertBanner message={done ? "Your password has been set. You can now sign in." : null} variant="success"/>{!done && <><PasswordField id="password" label="New password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} /><PrimaryButton isLoading={loading} loadingText="Saving…">Save password</PrimaryButton></>}<p className="text-center text-sm text-muted"><Link to="/login" className="text-accent hover:underline">Go to sign in</Link></p></form></AuthLayout>;
}
