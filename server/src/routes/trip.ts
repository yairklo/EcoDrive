import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../utils/prisma';

const tripSyncSchema = z.object({
  vehicleId: z.string().uuid(),
  distanceCityKm: z.number().nonnegative(),
  distanceHighwayKm: z.number().nonnegative(),
  accelerationPenaltyMl: z.number().nonnegative(),
});

export default async function tripRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Sync trip telemetry
  app.post('/sync', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const data = tripSyncSchema.parse(request.body);

      // Verify vehicle ownership
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      const tripSync = await prisma.tripSync.create({
        data,
      });

      return reply.status(201).send({ message: 'Telemetry synced successfully', tripSync });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get trips for vehicle
  app.get('/vehicle/:vehicleId', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { vehicleId } = request.params as { vehicleId: string };

      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      const trips = await prisma.tripSync.findMany({
        where: { vehicleId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });

      return reply.send({ trips });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get aggregated analytics for vehicle
  app.get('/vehicle/:vehicleId/analytics', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { vehicleId } = request.params as { vehicleId: string };

      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      const aggregations = await prisma.tripSync.aggregate({
        where: { vehicleId },
        _sum: {
          distanceCityKm: true,
          distanceHighwayKm: true,
          accelerationPenaltyMl: true,
        },
        _count: {
          id: true,
        },
      });

      return reply.send({ analytics: aggregations });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
}
