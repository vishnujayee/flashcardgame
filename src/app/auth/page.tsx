"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) router.replace("/");
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setIsLoading(true);
    
    const supabase = getSupabaseBrowserClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Logged in successfully!");
        
      } else {
        // Sign up flow
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        
        if (error) throw error;
        
        if (data.user) {
          // Sync user to MongoDB after successful signup
          try {
            const response = await fetch('/api/users/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                supabaseUserId: data.user.id, 
                email: data.user.email 
              }),
            });
            
            if (!response.ok) {
              console.warn('Failed to sync user to MongoDB, but signup succeeded');
            }
          } catch (syncError) {
            console.warn('User sync failed:', syncError);
          }
        }
        
        setMessage("Signup complete! Please check your email for confirmation.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Log in" : "Sign up"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="Email" 
          className="w-full border px-3 py-2 rounded" 
          required 
          disabled={isLoading}
        />
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Password" 
          className="w-full border px-3 py-2 rounded" 
          required 
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="w-full px-4 py-2 bg-black text-white rounded disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : (mode === "login" ? "Log in" : "Sign up")}
        </button>
      </form>
      <div className="flex items-center gap-2 text-sm">
        <span>{mode === "login" ? "Don't have an account?" : "Already have an account?"}</span>
        <button 
          onClick={() => setMode(mode === "login" ? "signup" : "login")} 
          className="underline"
          disabled={isLoading}
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </div>
      {message && <p className="text-green-700 text-sm">{message}</p>}
      {error && <p className="text-red-700 text-sm">{error}</p>}
    </div>
  );
}