import React from 'react'
import Link from 'next/link'
import APP from '@/config'

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-950/80 backdrop-blur-md mt-12 relative z-10 py-6 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>{APP.fullName}</span>
          <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">•</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Competitive Cybersecurity</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link href="/challenges" className="hover:text-sky-500 dark:hover:text-sky-300 transition-colors">
            Challenges
          </Link>
          <Link href="/scoreboard" className="hover:text-sky-500 dark:hover:text-sky-300 transition-colors">
            Scoreboard
          </Link>
          <Link href="/rules" className="hover:text-sky-500 dark:hover:text-sky-300 transition-colors">
            Rules
          </Link>
          <a
            href={APP.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-500 dark:hover:text-sky-300 transition-colors"
          >
            GitHub
          </a>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          &copy; {currentYear} {APP.shortName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
