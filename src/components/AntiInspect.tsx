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
      if (!e || !e.key) return
      if (e.key === 'F12') {
        e.preventDefault()
        return
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      const key = (e.key || '').toLowerCase()

      // Blokir Windows + V (Clipboard History Windows)
      const isWinOrMeta = e.metaKey || (typeof e.getModifierState === 'function' && e.getModifierState('OS'))
      if (isWinOrMeta && (key === 'v' || e.code === 'KeyV')) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Blokir Ctrl+C / Cmd+C di seluruh dokumen agar konten tidak bisa di-copy
      if (isCtrlOrCmd && (key === 'c' || e.code === 'KeyC')) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (isCtrlOrCmd) {
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

    // 3. Blokir Event Copy pada seluruh halaman
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', handleKeyDown, true)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keyup', handleKeyDown, true)
      document.removeEventListener('copy', handleCopy)
    }
  }, [])

  return null
}
