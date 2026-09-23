'use client'

import { useEffect } from 'react'

export default function AntiInspect() {
  useEffect(() => {
    // 1. Matikan Klik Kanan (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    // 2. Blokir Shortcut: F12, Ctrl+C, Windows+V, Ctrl+U, Ctrl+Shift+I/J/C, Ctrl+S
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault()
        return
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Blokir Windows + V (Clipboard History Windows)
      if (e.metaKey && (key === 'v' || e.code === 'KeyV')) {
        e.preventDefault()
        return
      }

      if (isCtrlOrCmd) {
        // Blokir Ctrl+C / Cmd+C pada teks halaman agar soal tidak bisa di-copy
        if (key === 'c' && !e.shiftKey) {
          const target = document.activeElement
          const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
          if (!isInput) {
            e.preventDefault()
            return
          }
        }

        // Ctrl+U / Cmd+U (View Source)
        if (key === 'u') {
          e.preventDefault()
          return
        }

        // Ctrl+S / Cmd+S (Save Page)
        if (key === 's') {
          e.preventDefault()
          return
        }

        // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools / Inspect Element)
        if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
          e.preventDefault()
          return
        }
      }
    }

    // 3. Blokir Event Copy pada teks halaman (kecuali di dalam input form)
    const handleCopy = (e: ClipboardEvent) => {
      const target = document.activeElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (!isInput) {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('copy', handleCopy)
    }
  }, [])

  return null
}
