import { getAdminFromCookies } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import AdminClient from './AdminClient'

export const metadata = {
  title: 'Admin Panel',
  robots: 'noindex,nofollow',
}

export default async function AdminPanelPage() {
  const admin = await getAdminFromCookies()

  // If not authenticated, show login form (AdminClient handles this)
  if (!admin) {
    return <AdminClient admin={null} />
  }

  // Fetch admin user details
  const user = await db.user.findUnique({
    where: { id: admin.userId },
    select: { id: true, name: true, email: true, adminRole: true, isSuperAdmin: true }
  })

  if (!user) {
    return <AdminClient admin={null} />
  }

  // If authenticated, show the admin dashboard
  return (
    <AdminClient
      admin={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.adminRole || admin.role,
        isSuperAdmin: user.isSuperAdmin || admin.isSuperAdmin,
        twoFactorVerified: admin.twoFactorVerified,
      }}
    />
  )
}
