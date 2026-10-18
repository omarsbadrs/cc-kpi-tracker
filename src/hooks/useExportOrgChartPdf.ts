"use client"

import { useCallback, useState } from "react"

/**
 * Captures a DOM element (by id) as a PDF and triggers a download.
 * Handles dark/light themes by compositing transparent backgrounds correctly.
 */
export function useExportOrgChartPdf() {
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(async (elementId: string, filename: string) => {
    setIsExporting(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])

      const el = document.getElementById(elementId)
      if (!el) throw new Error(`Element #${elementId} not found`)

      // The design-system tokens for whichever theme is on screen, resolved
      // to solid colours (html2canvas can't follow var()).
      const root = getComputedStyle(document.documentElement)
      const token = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback
      const bgColor = token("--page", "#f4f4f6")
      const cardBg = token("--surface", "#ffffff")
      const lineColor = token("--hairline-strong", "#d8d8e0")
      const borderColor = token("--hairline", "#e6e6eb")
      const textPrimary = token("--ink", "#131417")
      const textMuted = token("--ink-3", "#6c6e77")

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth + 64,
        windowHeight: el.scrollHeight + 64,
        onclone: (_doc, clonedEl) => {
          // Force solid backgrounds so transparency composites correctly
          clonedEl.style.backgroundColor = bgColor
          clonedEl.style.backgroundImage = "none"

          // Replace all CSS variables with resolved values on cloned elements
          clonedEl.querySelectorAll<HTMLElement>("*").forEach((node) => {
            const cs = window.getComputedStyle(node)
            const rect = node.getBoundingClientRect()
            const isConnectorLine =
              (rect.width <= 2 && rect.height > 4) ||
              (rect.height <= 2 && rect.width > 4)

            const bg = cs.backgroundColor
            if (bg && bg.startsWith("rgba")) {
              const match = bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
              if (match) {
                const alpha = parseFloat(match[4] ?? "1")
                if (alpha < 0.3) {
                  // 1px connector lines get a visible line color; other near-transparent
                  // elements (cards) get the solid card background
                  node.style.backgroundColor = isConnectorLine ? lineColor : cardBg
                }
              }
            }

            // Fix border colors that resolve to transparent
            const bc = cs.borderColor
            if (bc && bc.includes("rgba")) {
              const match = bc.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
              if (match) {
                const alpha = parseFloat(match[4] ?? "1")
                if (alpha < 0.3) node.style.borderColor = borderColor
              }
            }
          })

          // Ensure text colors render
          clonedEl.style.color = textPrimary
          clonedEl.querySelectorAll<HTMLElement>("p, span, div").forEach((node) => {
            const cs = window.getComputedStyle(node)
            const color = cs.color
            if (color === "rgba(0, 0, 0, 0)" || color === "transparent") {
              node.style.color = textMuted
            }
          })
        },
      })

      const imgData = canvas.toDataURL("image/png")
      const imgW = canvas.width
      const imgH = canvas.height

      // Landscape for wide charts, portrait for tall ones
      const orientation = imgW > imgH ? "landscape" : "portrait"
      const pdf = new jsPDF({ orientation, unit: "px", format: [imgW / 2, imgH / 2] })

      pdf.addImage(imgData, "PNG", 0, 0, imgW / 2, imgH / 2)
      pdf.save(filename)
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportPdf, isExporting }
}
