"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import Loader from "@/components/custom/loading"
import BackButton from "@/components/custom/BackButton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/AuthContext"
import { isAdmin } from "@/lib/admin"
import { EventSettings, getEventSettings, updateEventSettings } from "@/lib/engagement"

function toLocalInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null
}

export default function AdminEventPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (authLoading) return
      if (!user) {
        router.push("/login")
        return
      }
      const ok = await isAdmin()
      if (!mounted) return
      if (!ok) {
        router.push("/challenges")
        return
      }
      try {
        setSettings(await getEventSettings())
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [authLoading, user, router])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await updateEventSettings({
        event_name: settings.event_name,
        is_enabled: settings.is_enabled,
        starts_at: fromLocalInput(toLocalInput(settings.starts_at)),
        ends_at: fromLocalInput(toLocalInput(settings.ends_at)),
        freeze_scoreboard: settings.freeze_scoreboard,
        freeze_at: fromLocalInput(toLocalInput(settings.freeze_at)),
      })
      setSettings(updated)
      toast.success("Event settings saved")
    } catch (err) {
      console.error(err)
      toast.error("Failed to save event settings")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return <Loader fullscreen color="text-orange-500" />
  if (!user || !settings) return null

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <BackButton href="/admin" label="Back to Admin" />
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Event Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input
                value={settings.event_name}
                onChange={(e) => setSettings({ ...settings, event_name: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(settings.starts_at)}
                  onChange={(e) => setSettings({ ...settings, starts_at: fromLocalInput(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(settings.ends_at)}
                  onChange={(e) => setSettings({ ...settings, ends_at: fromLocalInput(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div>
                <Label>Enable Event Mode</Label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Adds event leaderboard scope and event status.</p>
              </div>
              <Switch
                checked={settings.is_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Freeze Scoreboard</Label>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Public leaderboards ignore solves after the freeze time.</p>
                </div>
                <Switch
                  checked={settings.freeze_scoreboard}
                  onCheckedChange={(checked) => setSettings({ ...settings, freeze_scoreboard: checked })}
                />
              </div>
              <Input
                type="datetime-local"
                value={toLocalInput(settings.freeze_at)}
                onChange={(e) => setSettings({ ...settings, freeze_at: fromLocalInput(e.target.value) })}
              />
            </div>

            <div className="flex justify-end">
              <Button disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Event Settings"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
