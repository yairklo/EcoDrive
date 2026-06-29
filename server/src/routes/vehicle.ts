import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../utils/prisma';

const createVehicleSchema = z.object({
  type: z.enum(['Mini/Hatchback', 'Sedan/Family', 'SUV/Crossover', 'Heavy/Commercial']),
  fuelCapacity: z.number().min(20).max(150),
  massKg: z.number().positive(),
  thermalEfficiency: z.number().positive().max(1),
  clientUuid: z.string().uuid().optional(),
});

const updateVehicleSchema = createVehicleSchema.partial();

export default async function vehicleRoutes(app: FastifyInstance) {
  // Protect all vehicle routes
  app.addHook('onRequest', app.authenticate);

  // Get user's vehicles
  app.get('/', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const vehicles = await prisma.vehicle.findMany({
        where: { ownerId: decoded.userId },
      });
      return reply.send({ vehicles });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Create a new vehicle
  app.post('/', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { type, fuelCapacity, clientUuid, massKg, thermalEfficiency } = createVehicleSchema.parse(request.body);

      // Check Idempotency
      if (clientUuid) {
        const existing = await prisma.vehicle.findUnique({
          where: { clientUuid },
        });
        if (existing) {
          return reply.status(200).send({ message: 'Vehicle already synced', vehicle: existing });
        }
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          clientUuid,
          ownerId: decoded.userId,
          type,
          fuelCapacity,
          massKg,
          thermalEfficiency,
        },
      });

      return reply.status(201).send({ message: 'Vehicle created successfully', vehicle });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Update a vehicle
  app.put('/:id', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { id } = request.params as { id: string };
      const data = updateVehicleSchema.parse(request.body);

      // Verify ownership
      const vehicle = await prisma.vehicle.findUnique({ where: { id } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      const updatedVehicle = await prisma.vehicle.update({
        where: { id },
        data,
      });

      return reply.send({ message: 'Vehicle updated successfully', vehicle: updatedVehicle });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Delete a vehicle
  app.delete('/:id', async (request, reply) => {
    try {
      const decoded = request.user as any;
      const { id } = request.params as { id: string };

      const vehicle = await prisma.vehicle.findUnique({ where: { id } });
      if (!vehicle || vehicle.ownerId !== decoded.userId) {
        return reply.status(404).send({ error: 'Vehicle not found or unauthorized' });
      }

      await prisma.vehicle.delete({ where: { id } });

      return reply.send({ message: 'Vehicle deleted successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
