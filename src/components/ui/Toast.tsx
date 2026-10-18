"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertCircle, Check, Hourglass, Trash2, WifiOff, Info, type LucideIcon } from "lucide-react"

// Port of the design system's toast.js: an ink pill at the bottom, 2.4s (6s
// with an action), paused while hovered or focused. Copy has no full stop;
// an error names the next step ("Could not save. Check your connection").

export type ToastIcon = "check" | "alert" | "trash" | "hourglass" | "wifiOff" | "info"

const ICONS: Record<ToastIcon, LucideIcon> = {
  check: Check,
  alert: AlertCircle,
  trash: Trash2,
  hourglass: Hourglass,
  wifiOff: WifiOff,
  info: Info,
}

interface ToastOptions {
  icon?: ToastIcon
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastItem extends Required<Pick<ToastOptions, "icon">> {
  id: number
  message: string
  duration: number
  action?: ToastOptions["action"]
  leaving: boolean
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {})

/** `const toast = useToast(); toast("Saved")` */
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const remove = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 200)
  }, [])

  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = nextId.current++
    const duration = options.duration ?? (options.action ? 6000 : 2400)
    setItems((list) => [
      ...list.slice(-2),
      { id, message, duration, icon: options.icon ?? "check", action: options.action, leaving: false },
    ])
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* The persistent root is the live region, so additions are announced. */}
      <div className="toast-root" role="status" aria-live="polite">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const due = useRef(0)
  const Icon = ICONS[item.icon]

  const arm = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    due.current = Date.now() + ms
    timer.current = setTimeout(onDone, ms)
  }, [onDone])

  useEffect(() => {
    arm(item.duration)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [arm, item.duration])

  const pause = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  const resume = () => arm(Math.max(1500, due.current - Date.now()))

  return (
    <div
      className={`toast${item.leaving ? " leaving" : ""}`}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      <span>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onDone()
            item.action?.onClick()
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  )
}
