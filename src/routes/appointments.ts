import { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { sendAppointmentNotification } from '../lib/mailer.js';

export async function appointmentRoutes(app: FastifyInstance) {
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

    const appointment = await app.prisma.appointment.create({
      data: {
        name,
        phone,
        email: email || null,
        date: new Date(date),
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
      ).catch(() => {}); // email hatası request'i engellesin
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
