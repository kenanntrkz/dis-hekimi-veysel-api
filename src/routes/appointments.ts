import { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { sendAppointmentNotification } from '../lib/mailer.js';

export async function appointmentRoutes(app: FastifyInstance) {
  // Public: seçilen güne ait dolu saatleri getir
  app.get('/slots', async (request, reply) => {
    const { date } = request.query as { date?: string };
    if (!date) return reply.status(400).send({ message: 'date parametresi gerekli (YYYY-MM-DD)' });

    // Günün başı ve sonu (UTC)
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const taken = await app.prisma.appointment.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        status: { in: ['pending', 'confirmed'] },
      },
      select: { date: true },
    });

    // "HH:MM" formatında dolu saatler listesi
    const slots = taken.map((a) => {
      const d = new Date(a.date);
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    return reply.send({ bookedSlots: slots });
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

    // Çakışma kontrolü: aynı dakikada pending/confirmed randevu var mı?
    const slotStart = new Date(requestedDate);
    const slotEnd = new Date(requestedDate.getTime() + 59 * 1000); // aynı dakika aralığı

    const conflict = await app.prisma.appointment.findFirst({
      where: {
        date: { gte: slotStart, lte: slotEnd },
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (conflict) {
      return reply.status(409).send({
        message: 'Bu saat dolu. Lütfen başka bir saat seçin.',
      });
    }

    const appointment = await app.prisma.appointment.create({
      data: {
        name,
        phone,
        email: email || null,
        date: requestedDate,
        subject: subject || null,
        notes: notes || null,
      },
    });

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
        status as 'confirmed' | 'cancelled'
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
