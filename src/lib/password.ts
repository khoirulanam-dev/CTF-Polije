export const MIN_PASSWORD_LENGTH = 8

export type PasswordRequirement = {
  id: 'length' | 'uppercase' | 'number' | 'special'
  label: string
  valid: boolean
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: 'length',
      label: `Minimal ${MIN_PASSWORD_LENGTH} karakter`,
      valid: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'Minimal 1 huruf kapital (A-Z)',
      valid: /[A-Z]/.test(password),
    },
    {
      id: 'number',
      label: 'Minimal 1 angka (0-9)',
      valid: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'Minimal 1 karakter khusus (@, !, dll.)',
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ]
}

export function validatePassword(password: string): string | null {
  const failedRequirement = getPasswordRequirements(password).find(
    (requirement) => !requirement.valid,
  )

  if (failedRequirement) {
    return `Password harus memenuhi: ${failedRequirement.label}`
  }

  return null
}
