"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getCombinedNotifications } from '@/lib/challenges'
import { useAuth } from '@/contexts/AuthContext'
import { AppNotification } from '@/types'
import { supabase } from '@/lib/supabase'

type NotificationsContextType = {
  unreadCount: number
  notifications: AppNotification[]
  activeAlert: AppNotification | null
  dismissAlert: () => void
  refresh: () => Promise<void>
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

const SEEN_KEY_PREFIX = 'ctfs_seen_notifications_v2:'
const LAST_ALERT_KEY_PREFIX = 'ctfs_last_seen_alert_v1:'

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [activeAlert, setActiveAlert] = useState<AppNotification | null>(null)
  const hasCheckedAlertOnLogin = useRef<boolean>(false)

  const storageKey = user ? `${SEEN_KEY_PREFIX}${user.id}` : `${SEEN_KEY_PREFIX}anon`
  const alertStorageKey = user ? `${LAST_ALERT_KEY_PREFIX}${user.id}` : `${LAST_ALERT_KEY_PREFIX}anon`

  const dismissAlert = useCallback(() => {
    setActiveAlert(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      setNotifications([])
      setActiveAlert(null)
      return
    }

    try {
      const combined = await getCombinedNotifications(50)
      setNotifications(combined)

      const ids = combined.map((n) => n.id)
      const seenJson = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      const seen: string[] = seenJson ? JSON.parse(seenJson) : []
      const unread = ids.filter((id) => !seen.includes(id)).length
      setUnreadCount(unread)

      // Cek apakah ada pengumuman / soal baru untuk alert pop-up login pertama kali
      if (!hasCheckedAlertOnLogin.current && combined.length > 0) {
        hasCheckedAlertOnLogin.current = true
        const lastSeenAlertId = typeof window !== 'undefined' ? localStorage.getItem(alertStorageKey) : null

        // Cari item terbaru yang berupa feature_update, system_update, atau new_challenge
        const latestFeatureOrChall = combined.find(
          (item) => item.notif_type === 'feature_update' || item.notif_type === 'system_update' || item.notif_type === 'new_challenge'
        )

        if (latestFeatureOrChall && latestFeatureOrChall.id !== lastSeenAlertId) {
          setActiveAlert(latestFeatureOrChall)
          try {
            localStorage.setItem(alertStorageKey, latestFeatureOrChall.id)
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Failed to refresh notifications', err)
    }
  }, [user, storageKey, alertStorageKey])

  const markAllRead = useCallback(() => {
    try {
      getCombinedNotifications(50).then((combined) => {
        const ids = combined.map((n) => n.id)
        const seenJson = localStorage.getItem(storageKey)
        const seen: string[] = seenJson ? JSON.parse(seenJson) : []
        const merged = Array.from(new Set([...seen, ...ids]))
        localStorage.setItem(storageKey, JSON.stringify(merged))
        setUnreadCount(0)
      }).catch((err) => {
        console.warn('markAllRead failed to fetch notifs', err)
      })
    } catch (err) {
      console.warn('markAllRead error', err)
    }
  }, [storageKey])

  useEffect(() => {
    hasCheckedAlertOnLogin.current = false
    refresh()
  }, [user, refresh])

  // Real-time: dengarkan jika ada pengumuman baru yang dimasukkan
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('announcements_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          refresh()
          // Langsung tampilkan alert banner jika ada pengumuman baru realtime saat user online
          if (payload.new && (payload.new as any).is_active) {
            const newItem = payload.new as any
            setActiveAlert({
              id: `announcement-${newItem.id}`,
              notif_type: newItem.type === 'feature' ? 'feature_update' : 'system_update',
              title: newItem.title,
              description: newItem.description,
              badge: newItem.badge || 'FITUR BARU',
              link: newItem.link || '/challenges',
              created_at: newItem.created_at,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        notifications,
        activeAlert,
        dismissAlert,
        refresh,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
