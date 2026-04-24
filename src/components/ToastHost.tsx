import React, { useEffect, useState, useCallback } from "react";
import { ToastType, ToastItem } from "./Toast";

/**
 * Global toast queue — usable from any module without prop drilling.
 *
 * Drop-in replacement for `alert()`:
 *   import { toast } from "./components/ToastHost";
 *   toast.error("Something went wrong");
 *   toast.success("Saved!");
 *
 * Mount <ToastHost /> once in App.tsx.
 */

type Listener = (toasts: ToastItem[]) => void;

class ToastBus {
  private toasts: ToastItem[] = [];
  private listeners: Set<Listener> = new Set();
  private idCounter = 0;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.toasts);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn([...this.toasts]);
  }

  push(message: string, type: ToastType = "info", durationMs = 4000) {
    const id = ++this.idCounter;
    this.toasts = [...this.toasts, { id, message, type }];
    this.emit();
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.emit();
  }

  info(msg: string, ms?: number) { return this.push(msg, "info", ms); }
  success(msg: string, ms?: number) { return this.push(msg, "success", ms); }
  warning(msg: string, ms?: number) { return this.push(msg, "warning", ms); }
  error(msg: string, ms?: number) { return this.push(msg, "error", ms ?? 6000); }
}

export const toast = new ToastBus();

/** Mount once in App.tsx. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe(setItems);
  }, []);

  if (!items.length) return null;
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
      {items.map(t => <ToastItemView key={t.id} toast={t} onDismiss={() => toast.dismiss(t.id)} />)}
    </div>
  );
}

function ToastItemView({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(id);
  }, []);

  const colors: Record<ToastType, { border: string; icon: string }> = {
    info:    { border: "var(--accent)",  icon: "ℹ️" },
    success: { border: "var(--success)", icon: "✅" },
    warning: { border: "var(--warning)", icon: "⚠️" },
    error:   { border: "var(--danger)",  icon: "❌" },
  };
  const c = colors[t.type];

  return (
    <div
      style={{
        background: "var(--card)",
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
      <div style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t.message}</div>
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
