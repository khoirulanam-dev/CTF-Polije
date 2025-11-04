export const APP = {
  shortName: 'POLIJE CTF',
  fullName: 'POLIJE CTF Platform',
  description: 'Platform Internal CTF POLIJE',
  flagFormat: 'POLIJE{your_flag_here}',
  year: new Date().getFullYear(),
  challengeCategories: [
    'Intro',
    'Misc',
    'Osint',
    'Crypto',
    'Forensics',
    'Web',
    'Reverse',
    'Network',
    'Blockchain',
  ],
  links: {
    github: 'https://github.com/Anam1602',
    discord: 'https://discord.gg/bbVU2Ab2',
    nextjs: 'https://nextjs.org/',
    tailwind: 'https://tailwindcss.com/',
    framer: 'https://www.framer.com/motion/',
    supabase: 'https://supabase.com/',
    vercel: 'https://vercel.com/',
  },

  // Difficulty style mapping (use lowercase keys). Only color name, badge will map to classes.
  difficultyStyles: {
    Baby: 'cyan',
    Easy: 'green',
    Medium: 'yellow',
    Hard: 'red',
    Impossible: 'purple',
  },

  // Base URL (otomatis ambil dari env kalau ada)
  baseUrl:
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', // opsional fallback
  image_icon:
    process.env.NEXT_PUBLIC_SITE_ICON || 'favicon.ico',
  image_preview:
    process.env.NEXT_PUBLIC_SITE_PREVIEW || 'og-image.png',
}

export default APP
