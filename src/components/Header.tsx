"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    location.reload();
  }

  return (
    <header className="w-full border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">Flashcard Frenzy</Link>
        <nav className="flex items-center gap-4">
          <Link href="/play" className="underline">Find Match</Link>
          {userEmail ? (
            <>
              <span className="text-sm text-gray-600">{userEmail}</span>
              <button onClick={logout} className="text-sm border px-2 py-1 rounded">Sign out</button>
            </>
          ) : (
            <Link href="/auth" className="text-sm border px-2 py-1 rounded">Log in / Sign up</Link>
          )}
        </nav>
      </div>
    </header>
  );
}


