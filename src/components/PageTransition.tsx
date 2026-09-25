'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

import { useReducedMotion } from '@/contexts/ReducedMotionContext'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { reducedMotion } = useReducedMotion()

  // Accessibility: fallback instan jika pengguna mengaktifkan reduced motion
  if (reducedMotion) {
    return <>{children}</>
  }

  return (
    <div
      style={{
        perspective: 1200,
        perspectiveOrigin: '50% 50%',
        overflowX: 'clip',
      }}
      className="w-full min-h-[calc(100vh-3.5rem)]"
    >
      <motion.div
        key={pathname}
        initial={{
          opacity: 0.25,
          rotateY: 55,
          scale: 0.94,
          transformOrigin: 'left center',
          filter: 'brightness(1.35) drop-shadow(0 0 20px rgba(6, 182, 212, 0.45))',
        }}
        animate={{
          opacity: 1,
          rotateY: 0,
          scale: 1,
          transformOrigin: 'left center',
          filter: 'brightness(1) drop-shadow(0 0 0px rgba(6, 182, 212, 0))',
          transitionEnd: {
            filter: 'none', // Melepaskan GPU filter setelah animasi selesai untuk performa maksimal
          },
        }}
        transition={{
          duration: 0.38, // Durasi cepat & snappy agar fast-load tetap terjaga
          ease: [0.16, 1, 0.3, 1], // Kurva percepatan cubic-bezier halus
        }}
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform, opacity',
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
