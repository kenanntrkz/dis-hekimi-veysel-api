import { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { sendAppointmentNotification, sendAppointmentCreated } from '../lib/mailer.js';

function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // belirsiz karakterler çıkarıldı (0,O,I,1)
  let code = 'DT-';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function appointmentRoutes(app: FastifyInstance) {
  // Public: seçilen güne ait dolu saatleri getir
  app.get('/slots', async (request, reply) => {
    const { date } = request.query as { date?: string };
    if (!date) return reply.status(400).send({ message: 'date parametresi gerekli (YYYY-MM-DD)' });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const taken = await app.prisma.appointment.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        status: { in: ['pending', 'confirmed'] },
      },
      select: { date: true },
    });

    const slots = taken.map((a) => {
      const d = new Date(a.date);
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    return reply.send({ bookedSlots: slots });
  });

  // Public: referans koduyla randevu sorgula
  app.get('/lookup', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ message: 'Randevu kodu gerekli' });

    const appointment = await app.prisma.appointment.findUnique({
      where: { referenceCode: code.toUpperCase().trim() },
    });

    if (!appointment) {
      return reply.status(404).send({ message: 'Randevu bulunamadı. Kodu kontrol edin.' });
    }

    return reply.send(appointment);
  });

  // Public: referans koduyla randevu iptal et
  app.post('/cancel', async (request, reply) => {
    const { code } = request.body as { code?: string };
    if (!code) return reply.status(400).send({ message: 'Randevu kodu gerekli' });

    const appointment = await app.prisma.appointment.findUnique({
      where: { referenceCode: code.toUpperCase().trim() },
    });

    if (!appointment) {
      return reply.status(404).send({ message: 'Randevu bulunamadı.' });
    }

    if (appointment.status === 'cancelled') {
      return reply.status(400).send({ message: 'Bu randevu zaten iptal edilmiş.' });
    }

    if (appointment.status === 'confirmed') {
      // Onaylanmış randevuyu hasta iptal etmek istiyorsa uyar ama izin ver
    }

    const updated = await app.prisma.appointment.update({
      where: { referenceCode: code.toUpperCase().trim() },
      data: { status: 'cancelled' },
    });

    if (updated.email) {
      sendAppointmentNotification(updated.email, updated.name, updated.date, 'cancelled').catch(() => {});
    }

    return reply.send(updated);
  });

  // Public: referans koduyla randevu yeniden planla
  app.post('/reschedule', async (request, reply) => {
    const { code, date } = request.body as { code?: string; date?: string };
    if (!code || !date) return reply.status(400).send({ message: 'Randevu kodu ve yeni tarih gerekli' });

    const appointment = await app.prisma.appointment.findUnique({
      where: { referenceCode: code.toUpperCase().trim() },
    });

    if (!appointment) {
      return reply.status(404).send({ message: 'Randevu bulunamadı.' });
    }

    if (appointment.status === 'cancelled') {
      return reply.status(400).send({ message: 'İptal edilmiş randevu yeniden planlanamaz. Yeni randevu oluşturun.' });
    }

    const newDate = new Date(date);
    const slotEnd = new Date(newDate.getTime() + 59 * 1000);

    // Çakışma kontrolü (kendi randevusu hariç)
    const conflict = await app.prisma.appointment.findFirst({
      where: {
        date: { gte: newDate, lte: slotEnd },
        status: { in: ['pending', 'confirmed'] },
        NOT: { referenceCode: code.toUpperCase().trim() },
      },
    });

    if (conflict) {
      return reply.status(409).send({ message: 'Bu saat dolu. Lütfen başka bir saat seçin.' });
    }

    const updated = await app.prisma.appointment.update({
      where: { referenceCode: code.toUpperCase().trim() },
      data: { date: newDate, status: 'pending' }, // yeniden pending'e düşer, doktor tekrar onaylar
    });

    return reply.send(updated);
  });

  // Public: randevu talebi oluştur
  app.post('/', async (request, reply) => {
    const { name, phone, email, date, subject, notes } = request.body as {
      name?: string;
      phone?: string;
      email?: string;
      date?: string;
      subject?: string;
      notes?: string;
    };

    if (!name || !phone || !date) {
      return reply.status(400).send({ message: 'Ad, telefon ve tarih zorunlu' });
    }

    const requestedDate = new Date(date);
    const slotEnd = new Date(requestedDate.getTime() + 59 * 1000);

    const conflict = await app.prisma.appointment.findFirst({
      where: {
        date: { gte: requestedDate, lte: slotEnd },
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (conflict) {
      return reply.status(409).send({ message: 'Bu saat dolu. Lütfen başka bir saat seçin.' });
    }

    // Benzersiz referans kodu üret
    let referenceCode: string;
    let attempts = 0;
    do {
      referenceCode = generateReferenceCode();
      const exists = await app.prisma.appointment.findUnique({ where: { referenceCode } });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    const appointment = await app.prisma.appointment.create({
      data: {
        referenceCode,
        name,
        phone,
        email: email || null,
        date: requestedDate,
        subject: subject || null,
        notes: notes || null,
      },
    });

    if (appointment.email && appointment.referenceCode) {
      sendAppointmentCreated(appointment.email, appointment.name, appointment.date, appointment.referenceCode).catch(() => {});
    }

    return reply.status(201).send(appointment);
  });

  // Admin: tüm randevuları listele
  app.get('/admin', { preHandler: requireAuth }, async (_request, reply) => {
    const appointments = await app.prisma.appointment.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(appointments);
  });

  // Admin: durum güncelle + email bildirim
  app.put('/admin/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const appointment = await app.prisma.appointment.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    if (appointment.email && (status === 'confirmed' || status === 'cancelled')) {
      sendAppointmentNotification(
        appointment.email,
        appointment.name,
        appointment.date,
        status as 'confirmed' | 'cancelled',
        appointment.referenceCode
      ).catch(() => {});
    }

    return reply.send(appointment);
  });

  // Admin: randevu sil
  app.delete('/admin/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.appointment.delete({ where: { id: parseInt(id) } });
    return reply.send({ message: 'Randevu silindi' });
  });
}
