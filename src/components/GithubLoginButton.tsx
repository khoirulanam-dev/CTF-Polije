'use client'

import { useState } from 'react'
import { loginGithub } from '@/lib/auth'

export default function GithubLoginButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGithubSignIn = async () => {
    setLoading(true)
    setError('')
    try {
      const { error } = await loginGithub()
      if (error) {
        setError(error)
      }
    } catch {
      setError('GitHub sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        type="button"
        onClick={handleGithubSignIn}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-2 px-3 text-sm font-medium rounded-md border border-gray-400 bg-white text-gray-800 shadow-sm hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 dark:border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
      >
        {/* GitHub SVG logo */}
        <svg
          className="w-5 h-5 shrink-0 fill-current text-gray-900 dark:text-white"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span className="truncate">{loading ? 'Processing...' : 'GitHub'}</span>
      </button>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900 p-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
