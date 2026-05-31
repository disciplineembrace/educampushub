import { db } from '@/lib/db'
import { hashPassword } from '@/lib/admin-auth'

async function seedAdmin() {
  // Super Admin account (primary, immutable)
  const superAdminEmail = 'sagathiyapradip2002@gmail.com'
  const superAdminPassword = '@deval1808'
  const superAdminPhone = '9974331007'

  // Legacy admin (keep for reference, will be demoted to regular admin)
  const legacyAdminEmail = 'disciplineembrace@gmail.com'

  try {
    // ─── Create or update the Super Admin account ───
    const existingSuper = await db.user.findUnique({ where: { email: superAdminEmail } })

    if (existingSuper) {
      // Update existing user to be Super Admin
      const hash = await hashPassword(superAdminPassword)
      await db.user.update({
        where: { email: superAdminEmail },
        data: {
          isAdmin: true,
          adminRole: 'super_admin',
          isSuperAdmin: true,
          twoFactorEnabled: true,
          passwordHash: hash,
          mustChangePassword: false,
          isVerified: true,
          phone: superAdminPhone,
          name: 'Super Admin',
        }
      })
      console.log(`✅ Super Admin ${superAdminEmail} updated.`)
    } else {
      // Create new Super Admin user
      const hash = await hashPassword(superAdminPassword)
      await db.user.create({
        data: {
          email: superAdminEmail,
          name: 'Super Admin',
          isAdmin: true,
          adminRole: 'super_admin',
          isSuperAdmin: true,
          twoFactorEnabled: true,
          passwordHash: hash,
          mustChangePassword: false,
          isVerified: true,
          phone: superAdminPhone,
          city: 'Delhi',
        }
      })
      console.log(`✅ Super Admin account created: ${superAdminEmail}`)
    }

    // ─── Ensure no other user has isSuperAdmin = true ───
    await db.user.updateMany({
      where: {
        email: { not: superAdminEmail },
        isSuperAdmin: true,
      },
      data: {
        isSuperAdmin: false,
      }
    })

    // ─── Update legacy admin to regular admin (not super) ───
    if (superAdminEmail !== legacyAdminEmail) {
      const legacyAdmin = await db.user.findUnique({ where: { email: legacyAdminEmail } })
      if (legacyAdmin) {
        await db.user.update({
          where: { email: legacyAdminEmail },
          data: {
            isSuperAdmin: false,
            adminRole: 'moderator', // Demote to moderator
            twoFactorEnabled: false,
          }
        })
        console.log(`✅ Legacy admin ${legacyAdminEmail} demoted to moderator.`)
      }
    }

    console.log('\n📋 Super Admin credentials:')
    console.log(`   Email:    ${superAdminEmail}`)
    console.log(`   Password: ${superAdminPassword}`)
    console.log(`   Phone:    ${superAdminPhone}`)
    console.log(`   Panel:    /cnx-admin-panel`)
    console.log(`   Role:     super_admin (isSuperAdmin: true)`)
    console.log(`   2FA:      Enabled (OTP required on every login)`)
  } catch (error) {
    console.error('❌ Error seeding admin:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

seedAdmin()
