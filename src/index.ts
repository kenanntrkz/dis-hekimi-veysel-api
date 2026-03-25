import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prismaPlugin from './plugins/prisma.js';
import { authRoutes } from './routes/auth.js';
import { appointmentRoutes } from './routes/appointments.js';
import { messageRoutes } from './routes/messages.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dis-hekimi-jwt-secret-change-me',
  });
  await app.register(prismaPlugin);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok' }));

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(appointmentRoutes, { prefix: '/api/appointments' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  const port = parseInt(process.env.PORT || '3900');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  console.log(`Server running on ${host}:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
