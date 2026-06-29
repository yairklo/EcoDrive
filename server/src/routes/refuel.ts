import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createRefuelLogSchema = z.object({
  vehicleId: z.string().uuid(),
  odometer: z.number().int().positive(),
  litersPumped: z.number().positive(),
  costPerLiter: z.number().positive(),
});

export default async function refuelRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Get refuel logs for a specific vehicle
  app.get('/vehicle/:vehicleId', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { vehicleId } = request.params as { vehicleId: string };

      // Verify vehicle ownership
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      const logs = await prisma.refuelLog.findMany({
        where: { vehicleId },
        orderBy: { timestamp: 'desc' },
      });

      return reply.send({ logs });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Create a new refuel log
  app.post('/', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const data = createRefuelLogSchema.parse(request.body);

      // Verify vehicle ownership
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      // Check odometer logic
      const latestLog = await prisma.refuelLog.findFirst({
        where: { vehicleId: data.vehicleId },
        orderBy: { odometer: 'desc' },
      });

      if (latestLog && data.odometer <= latestLog.odometer) {
        return reply.status(400).send({
          error: `Odometer reading must be strictly greater than the previous log (${latestLog.odometer})`,
        });
      }

      const refuelLog = await prisma.refuelLog.create({
        data,
      });

      // Task 3.3: Hook into Adaptive Calibration Engine
      const { calibrateVehicle } = await import('../utils/calibration');
      await calibrateVehicle(data.vehicleId);

      return reply.status(201).send({ message: 'Refuel log created successfully', log: refuelLog });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
