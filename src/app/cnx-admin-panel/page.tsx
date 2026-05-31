import { getAdminFromCookies } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import AdminClient from './AdminClient'
import NotFoundPage from './NotFound'

export const metadata = {
  title: 'Page Not Found',
  robots: 'noindex,nofollow',
}

export default async function AdminPanelPage() {
  const admin = await getAdminFromCookies()

  // If not authenticated admin, show 404 (not "access denied"!)
  if (!admin) {
    return <NotFoundPage />
  }

  // Fetch admin user details
  const user = await db.user.findUnique({
    where: { id: admin.userId },
    select: { id: true, name: true, email: true, adminRole: true, isSuperAdmin: true }
  })

  if (!user) {
    return <NotFoundPage />
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
