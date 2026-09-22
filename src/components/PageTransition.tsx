'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

import { useReducedMotion } from '@/contexts/ReducedMotionContext'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { reducedMotion } = useReducedMotion()

  return (
    <motion.div
      key={pathname}
      initial={reducedMotion ? false : { opacity: 0, y: 6, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
