/** Round avatar: the photo, else initials on the accent wash. 28px; `big` 44px; `xl` 56px. */
export function UserAvatar({
  firstName,
  lastName,
  avatarUrl,
  big = false,
  xl = false,
}: {
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
  big?: boolean
  xl?: boolean
}) {
  const initials = `${(firstName || "?").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase()
  const cls = `user-avatar${xl ? " xl" : big ? " big" : ""}`
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={cls} style={{ objectFit: "cover" }} />
  }
  return (
    <span className={cls} aria-hidden="true">
      {initials}
    </span>
  )
}
