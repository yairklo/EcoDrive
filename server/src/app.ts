import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export const buildApp = () => {
  const app = Fastify({
    logger: true,
  });

  // Security headers
  app.register(helmet);

  // CORS config
  app.register(cors, {
    origin: '*', // For MVP, allow all or configure later
  });

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
