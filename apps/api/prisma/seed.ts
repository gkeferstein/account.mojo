import { PrismaClient, TenantRole, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@mojo-institut.de' },
    update: {},
    create: {
      clerkUserId: 'user_demo_123',
      email: 'demo@mojo-institut.de',
      firstName: 'Demo',
      lastName: 'User',
    },
  });
  console.log('✅ Created demo user:', demoUser.email);

  // Create a personal tenant for demo user
  const personalTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-personal' },
    update: {},
    create: {
      name: 'Demo Personal',
      slug: 'demo-personal',
      isPersonal: true,
    },
  });
  console.log('✅ Created personal tenant:', personalTenant.slug);

  // Create membership for personal tenant
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: personalTenant.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      tenantId: personalTenant.id,
      userId: demoUser.id,
      role: TenantRole.owner,
      status: MembershipStatus.active,
    },
  });
  console.log('✅ Created membership for personal tenant');

  // Create an organization tenant
  const orgTenant = await prisma.tenant.upsert({
    where: { slug: 'mojo-institut' },
    update: {},
    create: {
      name: 'MOJO Institut',
      slug: 'mojo-institut',
      isPersonal: false,
    },
  });
  console.log('✅ Created organization tenant:', orgTenant.slug);

  // Create membership for org tenant
  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: orgTenant.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      tenantId: orgTenant.id,
      userId: demoUser.id,
      role: TenantRole.admin,
      status: MembershipStatus.active,
    },
  });
  console.log('✅ Created membership for organization tenant');

  // Create default preferences
  await prisma.preferences.upsert({
    where: {
      tenantId_userId: {
        tenantId: personalTenant.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      tenantId: personalTenant.id,
      userId: demoUser.id,
      payload: {
        newsletter: false,
        productUpdates: true,
        marketingEmails: false,
        emailNotifications: true,
        pushNotifications: false,
        language: 'de',
        timezone: 'Europe/Berlin',
      },
    },
  });
  console.log('✅ Created default preferences');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


