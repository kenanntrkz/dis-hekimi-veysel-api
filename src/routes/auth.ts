import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({ message: 'E-posta ve şifre gerekli' });
    }

    const admin = await app.prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return reply.status(401).send({ message: 'Kullanıcı bulunamadı' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return reply.status(401).send({ message: 'Şifre yanlış' });
    }

    const token = app.jwt.sign({ id: admin.id, email: admin.email }, { expiresIn: '7d' });
    return { token };
  });
}
