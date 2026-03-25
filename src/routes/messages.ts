import { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';

export async function messageRoutes(app: FastifyInstance) {
  // Public: mesaj gönder
  app.post('/', async (request, reply) => {
    const { name, phone, email, subject, body } = request.body as {
      name?: string;
      phone?: string;
      email?: string;
      subject?: string;
      body?: string;
    };

    if (!name || !body) {
      return reply.status(400).send({ message: 'Ad ve mesaj zorunlu' });
    }

    const message = await app.prisma.message.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        subject: subject || null,
        body,
      },
    });

    return reply.status(201).send(message);
  });

  // Admin: tüm mesajları listele
  app.get('/admin', { preHandler: requireAuth }, async (_request, reply) => {
    const messages = await app.prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(messages);
  });

  // Admin: okundu işaretle
  app.put('/admin/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { read } = request.body as { read: boolean };

    const message = await app.prisma.message.update({
      where: { id: parseInt(id) },
      data: { read },
    });
    return reply.send(message);
  });

  // Admin: mesaj sil
  app.delete('/admin/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.message.delete({ where: { id: parseInt(id) } });
    return reply.send({ message: 'Mesaj silindi' });
  });
}
