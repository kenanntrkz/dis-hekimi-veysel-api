import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.admin.findUnique({
    where: { email: 'admin@dtveyselarslan.com' },
  });

  if (!existing) {
    const hash = await bcrypt.hash('DisAdmin2026!', 10);
    await prisma.admin.create({
      data: { email: 'admin@dtveyselarslan.com', password: hash },
    });
    console.log('Admin oluşturuldu: admin@dtveyselarslan.com');
  } else {
    console.log('Admin zaten mevcut.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
