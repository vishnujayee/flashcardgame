"use client";
import { useEffect, useRef, useState } from "react";

// Define custom event type for better type safety
declare global {
  interface WindowEventMap {
    announce: CustomEvent<string>;
  }
}

export function LiveRegion() {
  const [message, setMessage] = useState("");
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function onAnnounce(e: CustomEvent<string>) {
      // Clear any pending message
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      
      // Clear current message and set new one with slight delay
      // This ensures screen readers detect the change
      setMessage("");
      
      timer.current = setTimeout(() => {
        setMessage(e.detail);
        timer.current = null;
      }, 50);
    }

    window.addEventListener("announce", onAnnounce as EventListener);
    
    return () => {
      // Cleanup on unmount
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      window.removeEventListener("announce", onAnnounce as EventListener);
    };
  }, []);

  return (
    <div 
      aria-live="polite" 
      aria-atomic="true" 
      className="sr-only" 
      data-testid="live-region"
      key={Date.now()} // Force re-render for screen readers
    >
      {message}
    </div>
  );
}

export function announce(text: string) {
  // Dispatch event for the LiveRegion component
  window.dispatchEvent(new CustomEvent("announce", { detail: text }));
  
  // Also announce directly for immediate feedback (fallback)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 0.8;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }
}

// Create separate helper functions instead of an object
export function announceSuccess(text: string) {
  announce(`Success: ${text}`);
}

export function announceError(text: string) {
  announce(`Error: ${text}`);
}

export function announceInfo(text: string) {
  announce(`Info: ${text}`);
}

export function announceWarning(text: string) {
  announce(`Warning: ${text}`);
}