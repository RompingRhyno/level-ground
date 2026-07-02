import { createHash, randomBytes } from 'crypto'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/** SHA-256 hex digest of a raw token string. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Generates a cryptographically random token and its SHA-256 hash. */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex')
  return { raw, hash: hashToken(raw) }
}

/** Minimum password requirements: 12+ chars, at least one digit or special char. */
export function isStrongPassword(password: string): boolean {
  if (password.length < 12) return false
  return /[\d!@#$%^&*()\-_=+[\]{};':",.<>/?\\|`~]/.test(password)
}

export async function sendUnlockEmail(
  email: string,
  rawToken: string,
  failedAttempts: number,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const url = `${base}/admin/unlock?token=${rawToken}`
  void resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM!,
    to: email,
    subject: 'Admin account locked — action required',
    html: `
      <p>Your admin account was locked after ${failedAttempts} failed sign-in attempts.</p>
      <p><a href="${url}">Unlock your account or reset your password</a></p>
      <p>This link expires in 1 hour. If you did not trigger this, someone may be
         attempting to access your account.</p>
    `,
  })
}

export async function sendInviteEmail(
  email: string,
  rawToken: string,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const url = `${base}/admin/accept-invite?token=${rawToken}`
  void resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM!,
    to: email,
    subject: 'You have been invited to the admin panel',
    html: `
      <p>You have been invited to access the admin panel.</p>
      <p><a href="${url}">Accept invitation and set your password</a></p>
      <p>This link expires in 48 hours.</p>
    `,
  })
}

export async function sendEmailChangeVerification(
  email: string,
  rawToken: string,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const url = `${base}/admin/verify-email?token=${rawToken}`
  void resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM!,
    to: email,
    subject: 'Verify your new email address',
    html: `
      <p>Click the link below to confirm your new admin email address.</p>
      <p><a href="${url}">Verify email</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  })
}

export async function sendEmailChangeNotice(currentEmail: string): Promise<void> {
  void resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM!,
    to: currentEmail,
    subject: 'Email change requested for your admin account',
    html: `
      <p>A request was made to change the email address on your admin account.</p>
      <p>If this wasn't you, contact your system administrator immediately.</p>
    `,
  })
}

export async function sendPasswordChangedNotice(email: string): Promise<void> {
  void resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM!,
    to: email,
    subject: 'Your admin account password was changed',
    html: `
      <p>Your admin account password was successfully changed.</p>
      <p>If this wasn't you, contact your system administrator immediately.</p>
    `,
  })
}
