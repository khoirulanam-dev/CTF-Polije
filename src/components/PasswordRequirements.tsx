import { getPasswordRequirements } from '@/lib/password'

type PasswordRequirementsProps = {
  password: string
}

export default function PasswordRequirements({
  password,
}: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password)

  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/25 px-3 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-slate-300">
        Persyaratan password:
      </p>
      <ul className="space-y-1 text-xs">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={requirement.valid ? 'text-emerald-300' : 'text-red-300'}
          >
            <span className="mr-2 inline-flex w-3 justify-center font-bold">
              {requirement.valid ? '✓' : '○'}
            </span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
