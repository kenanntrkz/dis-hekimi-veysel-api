import { FastifyInstance } from 'fastify';
import { requireAuth } from '../plugins/auth.js';

export async function adminRoutes(app: FastifyInstance) {
  // Dashboard istatistikleri
  app.get('/stats', { preHandler: requireAuth }, async (_request, reply) => {
    const [unreadMessages, pendingAppointments] = await Promise.all([
      app.prisma.message.count({ where: { read: false } }),
      app.prisma.appointment.count({ where: { status: 'pending' } }),
    ]);

    return reply.send({ unreadMessages, pendingAppointments });
  });
}
