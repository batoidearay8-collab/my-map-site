import React, { useEffect, useState, useCallback } from "react";

/**
 * Lightweight non-blocking toast notification system.
 * Replaces alert() calls which freeze the page.
 *
 * Usage:
 *   const { showToast, ToastContainer } = useToast();
 *   showToast("Saved!", "success");
 *   <ToastContainer />
 */

export type ToastType = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", durationMs = 4000) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (durationMs > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, durationMs);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ToastContainer = useCallback(() => {
    if (!toasts.length) return null;
    return (
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: "calc(100vw - 32px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map(t => (
          <ToastItemView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    );
  }, [toasts, dismiss]);

  return { showToast, dismiss, ToastContainer };
}

function ToastItemView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(id);
  }, []);

  const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
    info:    { bg: "var(--card)", border: "var(--accent)",  icon: "ℹ️" },
    success: { bg: "var(--card)", border: "var(--success)", icon: "✅" },
    warning: { bg: "var(--card)", border: "var(--warning)", icon: "⚠️" },
    error:   { bg: "var(--card)", border: "var(--danger)",  icon: "❌" },
  };
  const c = colors[toast.type];

  return (
    <div
      style={{
        background: c.bg,
        color: "var(--text)",
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${c.border}`,
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        minWidth: 240,
        maxWidth: 480,
        pointerEvents: "auto",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
      <div style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{toast.message}</div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          marginLeft: 4,
        }}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
