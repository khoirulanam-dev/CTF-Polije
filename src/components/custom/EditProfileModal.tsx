"use client"

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Camera, Github, Globe, Instagram, Linkedin } from 'lucide-react'
import { updateProfile, uploadProfileAvatar, ProfileUpdateResult } from '@/lib/users'
import { isValidUsername } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ImageWithFallback from '@/components/ImageWithFallback'
import Link from 'next/link'

type Props = {
  userId: string
  currentUsername: string
  currentPicture?: string | null
  currentBio?: string | null
  currentGithubUrl?: string | null
  currentLinkedinUrl?: string | null
  currentInstagramUrl?: string | null
  currentWebsiteUrl?: string | null
  onUsernameChange?: (username: string) => void
  onProfileChange?: (profile: ProfileUpdateResult) => void
  triggerButtonClass?: string
}

const fieldClass =
  'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-blue-500'

function trimOrEmpty(value?: string | null) {
  return value || ''
}

export default function EditProfileModal({
  userId,
  currentUsername,
  currentPicture,
  currentBio,
  currentGithubUrl,
  currentLinkedinUrl,
  currentInstagramUrl,
  currentWebsiteUrl,
  onUsernameChange,
  onProfileChange,
  triggerButtonClass = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState(currentUsername)
  const [avatarUrl, setAvatarUrl] = useState(trimOrEmpty(currentPicture))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bio, setBio] = useState(trimOrEmpty(currentBio))
  const [githubUrl, setGithubUrl] = useState(trimOrEmpty(currentGithubUrl))
  const [linkedinUrl, setLinkedinUrl] = useState(trimOrEmpty(currentLinkedinUrl))
  const [instagramUrl, setInstagramUrl] = useState(trimOrEmpty(currentInstagramUrl))
  const [websiteUrl, setWebsiteUrl] = useState(trimOrEmpty(currentWebsiteUrl))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!open) return
    setUsername(currentUsername)
    setAvatarUrl(trimOrEmpty(currentPicture))
    setAvatarFile(null)
    setBio(trimOrEmpty(currentBio))
    setGithubUrl(trimOrEmpty(currentGithubUrl))
    setLinkedinUrl(trimOrEmpty(currentLinkedinUrl))
    setInstagramUrl(trimOrEmpty(currentInstagramUrl))
    setWebsiteUrl(trimOrEmpty(currentWebsiteUrl))
    setError('')
    setSuccess('')
  }, [
    open,
    currentUsername,
    currentPicture,
    currentBio,
    currentGithubUrl,
    currentLinkedinUrl,
    currentInstagramUrl,
    currentWebsiteUrl,
  ])

  const previewUrl = useMemo(() => {
    if (!avatarFile) return avatarUrl
    return URL.createObjectURL(avatarFile)
  }, [avatarFile, avatarUrl])

  useEffect(() => {
    return () => {
      if (previewUrl && avatarFile) URL.revokeObjectURL(previewUrl)
    }
  }, [avatarFile, previewUrl])

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError('')
    setSuccess('')

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('File must be an image')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be 2 MB or smaller')
      return
    }

    setAvatarFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const usernameTrimmed = username.trim()
    const usernameError = isValidUsername(usernameTrimmed)
    if (usernameError) {
      setError(usernameError)
      setLoading(false)
      return
    }

    if (bio.length > 300) {
      setError('Bio must be 300 characters or less')
      setLoading(false)
      return
    }

    let nextAvatarUrl = avatarUrl.trim()
    if (avatarFile) {
      const upload = await uploadProfileAvatar(userId, avatarFile)
      if (upload.error || !upload.url) {
        setError(upload.error || 'Failed to upload profile photo')
        setLoading(false)
        return
      }
      nextAvatarUrl = upload.url
    }

    const result = await updateProfile(userId, {
      username: usernameTrimmed,
      avatar_url: nextAvatarUrl || null,
      bio: bio.trim() || null,
      github_url: githubUrl.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
    })

    if (result.error || !result.profile) {
      setError(result.error || 'Failed to update profile')
    } else {
      const profile = result.profile
      setSuccess('Profile updated!')
      setUsername(profile.username)
      setAvatarUrl(profile.picture || profile.avatar_url || '')
      setAvatarFile(null)
      onUsernameChange?.(profile.username)
      onProfileChange?.(profile)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerButtonClass}>Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 [&_button.absolute.right-4.top-4]:block md:[&_button.absolute.right-4.top-4]:hidden [&_button.absolute.right-4.top-4]:text-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Edit Profile</DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-300">
            Update your photo, bio, and public links.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ImageWithFallback
              src={previewUrl}
              alt={username}
              size={88}
              className="rounded-full border border-gray-300 dark:border-gray-600"
              fallbackBg="bg-blue-100 dark:bg-blue-900"
            />
            <div className="space-y-2">
              <Label
                htmlFor="avatar"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Camera className="h-4 w-4" />
                Upload Photo
              </Label>
              <Input
                id="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarChange}
                disabled={loading}
                className="hidden"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PNG, JPG, WEBP, or GIF. Max 2 MB.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              disabled={loading}
              className={fieldClass}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="bio">Bio</Label>
              <span className="text-xs text-gray-500 dark:text-gray-400">{bio.length}/300</span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A short intro for your profile"
              disabled={loading}
              maxLength={300}
              className={`${fieldClass} min-h-24 resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="github" className="inline-flex items-center gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </Label>
              <Input
                id="github"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
                disabled={loading}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="inline-flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Label>
              <Input
                id="linkedin"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                disabled={loading}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram" className="inline-flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                id="instagram"
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/username"
                disabled={loading}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website" className="inline-flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              <Input
                id="website"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
                className={fieldClass}
              />
            </div>
          </div>

          {error && <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>}
          {success && <div className="text-green-600 dark:text-green-400 text-sm">{success}</div>}

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white font-semibold"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </form>

        <div className="text-center mt-2">
          <Link
            href="/profile/password"
            className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
          >
            Change Password
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
