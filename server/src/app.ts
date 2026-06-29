import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';

export const buildApp = () => {
  const app = Fastify({
    logger: true,
  });

  // Security headers
  app.register(helmet);

  // JWT config
  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-fallback'
  });

  // Authentication Middleware
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  });

  // CORS config
  app.register(cors, {
    origin: '*', // For MVP, allow all or configure later
  });

  // Register Routes
  app.register(import('./routes/auth'), { prefix: '/api/auth' });
  app.register(import('./routes/vehicle'), { prefix: '/api/vehicles' });
  app.register(import('./routes/refuel'), { prefix: '/api/refuel' });

  // Centralized Error Handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  });

  // Basic Healthcheck Route
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
};
