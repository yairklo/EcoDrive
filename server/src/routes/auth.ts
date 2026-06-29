import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    try {
      const { email, password } = registerSchema.parse(request.body);

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists with this email' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      return reply.status(201).send({
        message: 'User registered successfully',
        userId: user.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const { email, password } = registerSchema.parse(request.body);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Generate JWT
      const token = app.jwt.sign({ userId: user.id, email: user.email }, { expiresIn: '7d' });

      return reply.send({
        message: 'Login successful',
        token,
        userId: user.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
