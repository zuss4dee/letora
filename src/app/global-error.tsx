"use client";

import { useEffect } from "react";

export const dynamic = "force-dynamic";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        backgroundColor: "#131313", 
        color: "white", 
        fontFamily: "system-ui, -apple-system, sans-serif",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ 
          textAlign: "center", 
          maxWidth: "400px", 
          padding: "24px",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px",
          backgroundColor: "rgba(255,255,255,0.02)"
        }}>
          <p style={{ 
            fontSize: "0.65rem", 
            fontWeight: "bold", 
            textTransform: "uppercase", 
            letterSpacing: "0.2em", 
            color: "#888",
            marginBottom: "12px"
          }}>
            Critical Error
          </p>
          <h1 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "300", 
            letterSpacing: "-0.02em", 
            marginBottom: "16px"
          }}>
            A serious error occurred.
          </h1>
          <p style={{ 
            fontSize: "0.875rem", 
            color: "#aaa", 
            lineHeight: "1.6",
            marginBottom: "24px"
          }}>
            The application encountered a problem and could not recover.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              minWidth: "140px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              backgroundColor: "#E2E2E2",
              padding: "10px 20px",
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "#131313",
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.2s"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
