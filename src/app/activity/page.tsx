"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Loader from "@/components/custom/loading"
import TitlePage from "@/components/custom/TitlePage"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { ActivityFeedItem, getActivityFeed } from "@/lib/engagement"
import { formatRelativeDate } from "@/lib/utils"

function describeActivity(item: ActivityFeedItem) {
  if (item.activity_type === "first_blood") {
    return {
      title: `${item.username} got First Blood`,
      detail: item.challenge_title ? `on ${item.challenge_title}` : "",
      tone: "text-red-600 dark:text-red-300",
    }
  }
  if (item.activity_type === "solve") {
    return {
      title: `${item.username} solved a challenge`,
      detail: item.challenge_title ? `${item.challenge_title} · ${item.points || 0} pts` : "",
      tone: "text-green-600 dark:text-green-300",
    }
  }
  if (item.activity_type === "new_challenge") {
    return {
      title: "New challenge released",
      detail: item.challenge_title ? `${item.challenge_title} · ${item.category || "General"}` : "",
      tone: "text-blue-600 dark:text-blue-300",
    }
  }
  return {
    title: `${item.username} joined ${item.team_name}`,
    detail: "Team activity",
    tone: "text-purple-600 dark:text-purple-300",
  }
}

export default function ActivityPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, user, router])

  useEffect(() => {
    const run = async () => {
      if (!user) return
      setLoading(true)
      try {
        setItems(await getActivityFeed(limit, 0))
      } catch (err) {
        console.error(err)
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [user, limit])

  if (authLoading || loading) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <TitlePage>Activity Feed</TitlePage>
          <Button variant="outline" size="sm" onClick={() => setLimit((value) => value + 50)}>Load More</Button>
        </div>

        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="divide-y divide-gray-200 p-0 dark:divide-gray-700">
            {items.map((item, idx) => {
              const info = describeActivity(item)
              return (
                <div key={`${item.activity_type}-${item.created_at}-${idx}`} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`font-semibold ${info.tone}`}>{info.title}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {item.challenge_id ? (
                          <Link href="/challenges" className="hover:underline">{info.detail}</Link>
                        ) : (
                          info.detail
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(item.created_at)}</span>
                  </div>
                </div>
              )
            })}
            {items.length === 0 && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">No activity yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
