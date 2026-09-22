'use client'

import { flushSync } from 'react-dom'
import { useCallback, useRef } from 'react'
import { Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/contexts/ReducedMotionContext'

type Theme = 'light' | 'dark'

type ViewTransitionLike = {
  ready: Promise<void>
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike
}

interface AnimatedThemeTogglerProps
  extends React.ComponentPropsWithoutRef<'button'> {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  duration?: number
  fromCenter?: boolean
}

export function AnimatedThemeToggler({
  theme,
  onThemeChange,
  duration = 360,
  fromCenter = false,
  className,
  onClick,
  ...props
}: AnimatedThemeTogglerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const transitioningRef = useRef(false)
  const animationRef = useRef<Animation | null>(null)
  const { reducedMotion } = useReducedMotion()

  const toggleTheme = useCallback(() => {
    if (props.disabled || transitioningRef.current) return

    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    const applyTheme = () => {
      root.classList.toggle('dark', nextTheme === 'dark')
      onThemeChange(nextTheme)
    }

    const viewTransitionDocument = document as ViewTransitionDocument
    const startViewTransition = viewTransitionDocument.startViewTransition

    if (reducedMotion || typeof startViewTransition !== 'function') {
      applyTheme()
      return
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const rect = buttonRef.current?.getBoundingClientRect()
    const x = fromCenter ? width / 2 : (rect?.left || 0) + (rect?.width || 0) / 2
    const y = fromCenter ? height / 2 : (rect?.top || 0) + (rect?.height || 0) / 2
    const radius = Math.hypot(
      Math.max(x, width - x),
      Math.max(y, height - y),
    )
    const radiusReference = Math.hypot(width, height) / Math.SQRT2
    const clipFrom = `circle(0% at ${(x / width) * 100}% ${(y / height) * 100}%)`
    const clipTo = `circle(${(radius / radiusReference) * 100}% at ${(x / width) * 100}% ${(y / height) * 100}%)`

    transitioningRef.current = true
    root.dataset.themeTransition = 'active'
    root.style.setProperty('--theme-transition-duration', `${duration}ms`)
    root.style.setProperty('--theme-transition-clip-from', clipFrom)

    const cleanup = () => {
      transitioningRef.current = false
      animationRef.current?.cancel()
      animationRef.current = null
      delete root.dataset.themeTransition
      root.style.removeProperty('--theme-transition-duration')
      root.style.removeProperty('--theme-transition-clip-from')
    }

    let transition: ViewTransitionLike
    try {
      transition = startViewTransition(() => {
        flushSync(applyTheme)
      })
    } catch {
      cleanup()
      applyTheme()
      return
    }

    transition.finished.finally(cleanup).catch(() => {})
    transition.ready
      .then(() => {
        animationRef.current = root.animate(
          { clipPath: [clipFrom, clipTo] },
          {
            duration,
            easing: 'ease-in-out',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      .catch(cleanup)
  }, [duration, fromCenter, onThemeChange, props.disabled, reducedMotion, theme])

  return (
    <button
      {...props}
      ref={buttonRef}
      type="button"
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={(event) => {
        toggleTheme()
        onClick?.(event)
      }}
      className={cn('shimmer-button', className)}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Ganti tema</span>
    </button>
  )
}
