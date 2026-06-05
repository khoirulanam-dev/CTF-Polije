"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import Loader from "@/components/custom/loading"
import TitlePage from "@/components/custom/TitlePage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { createTeam, getMyTeam, joinTeam, leaveTeam, MyTeam, TeamMember } from "@/lib/engagement"
import { formatRelativeDate } from "@/lib/utils"

const teamInputClass =
  "border-gray-400 bg-white text-gray-900 placeholder:text-gray-500 focus-visible:ring-blue-500 dark:border-gray-500 dark:bg-gray-950/60 dark:text-white dark:placeholder:text-gray-400"

function TeamsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [team, setTeam] = useState<MyTeam | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamName, setTeamName] = useState("")
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const shareLink = useMemo(() => {
    if (!team || team.is_solo || typeof window === "undefined") return ""
    return `${window.location.origin}/teams?invite=${team.invite_code}`
  }, [team])

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, user, router])

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getMyTeam()
      setTeam(data.team)
      setMembers(data.members)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load team")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async (isSolo: boolean) => {
    setSubmitting(true)
    try {
      const res = await createTeam(teamName, isSolo)
      if (!res.success) {
        toast.error(res.message || "Failed to create team")
        return
      }
      toast.success(isSolo ? "Solo team created" : "Team created")
      setTeamName("")
      await refresh()
    } catch (err) {
      console.error(err)
      toast.error("Failed to create team")
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setSubmitting(true)
    try {
      const res = await joinTeam(inviteCode.trim())
      if (!res.success) {
        toast.error(res.message || "Failed to join team")
        return
      }
      toast.success("Joined team")
      await refresh()
    } catch (err) {
      console.error(err)
      toast.error("Failed to join team")
    } finally {
      setSubmitting(false)
    }
  }

  const handleLeave = async () => {
    if (!confirm("Leave this team?")) return
    setSubmitting(true)
    try {
      const res = await leaveTeam()
      if (!res.success) {
        toast.error(res.message || "Failed to leave team")
        return
      }
      toast.success("Left team")
      setTeam(null)
      setMembers([])
      await refresh()
    } catch (err) {
      console.error(err)
      toast.error("Failed to leave team")
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <TitlePage>Teams</TitlePage>

        {!team ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Create Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  className={teamInputClass}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button disabled={submitting} onClick={() => handleCreate(false)}>Create Shared Team</Button>
                  <Button disabled={submitting} variant="outline" onClick={() => handleCreate(true)}>Create Solo Team</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Join Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  className={teamInputClass}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Invite code"
                />
                <Button disabled={submitting || !inviteCode.trim()} onClick={handleJoin}>Join with Invite Code</Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <Card className="bg-white dark:bg-gray-800">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-white">{team.name}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {team.is_solo ? "Solo team" : `${members.length} members`} · Joined as {team.my_role || "member"}
                  </p>
                </div>
                <Button variant="outline" disabled={submitting} onClick={handleLeave}>Leave Team</Button>
              </CardHeader>
              {!team.is_solo && (
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Invite Code</div>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <code className="font-mono text-lg font-semibold text-gray-900 dark:text-white">{team.invite_code}</code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(shareLink || team.invite_code)
                          toast.success("Invite copied")
                        }}
                      >
                        Copy Share Link
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Member Contribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        <th className="py-2">Member</th>
                        <th className="py-2 text-center">Solves</th>
                        <th className="py-2 text-center">Points</th>
                        <th className="py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.user_id} className="border-b last:border-0 dark:border-gray-700">
                          <td className="py-3 font-medium text-gray-900 dark:text-white">
                            {member.username}
                            {member.role === "owner" && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">Owner</span>}
                          </td>
                          <td className="py-3 text-center text-gray-700 dark:text-gray-300">{member.solves}</td>
                          <td className="py-3 text-center font-semibold text-gray-900 dark:text-white">{member.score}</td>
                          <td className="py-3 text-gray-500 dark:text-gray-400">{formatRelativeDate(member.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<Loader fullscreen color="text-orange-500" />}>
      <TeamsPageContent />
    </Suspense>
  )
}
