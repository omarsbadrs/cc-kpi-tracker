"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

// Port of the design system's modal.js: a bottom sheet under 640px, a
// centred dialog from 640px (480 wide, 720 with `wide`). Focus is trapped,
// Escape closes the topmost one, and focus returns to the opener.

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  wide?: boolean
  /** While set, the dialog refuses to close (work it started is running). */
  locked?: boolean
  children: ReactNode
}

const TABBABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, wide = false, locked = false, children }: ModalProps) {
  // Kept mounted for the 200ms closing animation after `open` turns false.
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      const active = document.activeElement
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
      setRendered(true)
      setClosing(false)
    } else if (rendered) {
      setClosing(true)
      const t = setTimeout(() => {
        setRendered(false)
        setClosing(false)
        if (openerRef.current?.isConnected) openerRef.current.focus()
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Callers pass inline onClose arrows; read the latest through a ref so the
  // key listener below isn't torn down on every render.
  const closeRef = useRef(onClose)
  const lockedRef = useRef(locked)
  closeRef.current = onClose
  lockedRef.current = locked
  const requestClose = useCallback(() => {
    if (!lockedRef.current) closeRef.current()
  }, [])

  // First focus: the first control on desktop; the panel on a phone, so the
  // keyboard doesn't pop up over the sheet.
  useEffect(() => {
    if (!rendered || closing) return
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>("input, select, textarea, button:not(.icon-btn)")
    if (first && window.matchMedia("(min-width: 640px)").matches) first.focus()
    else panel.focus({ preventScroll: true })
  }, [rendered, closing])

  useEffect(() => {
    if (!rendered) return
    document.body.classList.add("modal-open")
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Tab") return
      // Only the top of a stack (a confirm over a form) responds.
      const roots = document.querySelectorAll(".modal-root:not(.closing)")
      if (roots[roots.length - 1] !== rootRef.current) return
      if (e.key === "Escape") {
        e.preventDefault()
        requestClose()
        return
      }
      const panel = panelRef.current
      if (!panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(
        (c) => !(c as HTMLButtonElement).disabled && (c.offsetWidth || c.offsetHeight || c.getClientRects().length)
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const on = document.activeElement
      if (first && last && (e.shiftKey ? on === first || on === panel : on === last)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const own = rootRef.current
    return () => {
      document.removeEventListener("keydown", onKey)
      // Leave the scroll lock on while another dialog is still up.
      const others = [...document.querySelectorAll(".modal-root")].filter((r) => r !== own)
      if (!others.length) document.body.classList.remove("modal-open")
    }
  }, [rendered, requestClose])

  if (!rendered || typeof document === "undefined") return null

  return createPortal(
    <div ref={rootRef} className={`modal-root${closing ? " closing" : ""}`}>
      <div className="modal-scrim" onClick={requestClose} />
      <div
        ref={panelRef}
        className={`modal-panel${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="sheet-handle" />
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            title={locked ? "Wait for this to finish" : "Close"}
            disabled={locked}
            onClick={requestClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

interface ConfirmDialogProps {
  open: boolean
  /** A question: "Delete this period?" */
  title: string
  /** One sentence saying what will happen. */
  message: ReactNode
  /** Names the verb: "Delete period", never "OK". */
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} locked={busy}>
      <p style={{ color: "var(--ink-2)", marginBottom: 18, fontSize: 14 }}>{message}</p>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onConfirm()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
