// components/custom/BackButton.tsx
"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

type Props = {
  href?: string
  label?: string
  onClick?: () => void
  className?: string
}

export default function BackButton({ href, label = "Back", onClick, className = '' }: Props) {
  const router = useRouter()

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    if (href) router.push(href)
    else router.back()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white/80 hover:bg-slate-100 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-xs transition-all duration-150 ${className}`}
    >
      <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  )
}

