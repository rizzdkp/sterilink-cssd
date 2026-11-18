// Query baca untuk area Master. Semuanya dibatasi fasilitas admin.
import { prisma } from './db';
import type { Actor } from './identity';

export async function getFacilityAdmin(actor: Actor) {
  const [facility, policies] = await Promise.all([
    prisma.facility.findUniqueOrThrow({ where: { id: actor.facilityId } }),
    prisma.monitoringPolicy.findMany({ where: { facilityId: actor.facilityId } }),
  ]);
  return { facility, policies };
}

export async function getUsersAdmin(actor: Actor) {
  const [users, units] = await Promise.all([
    prisma.user.findMany({
      where: { facilityId: actor.facilityId },
      include: { unit: true, sessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.unit.findMany({ where: { facilityId: actor.facilityId, active: true }, orderBy: { code: 'asc' } }),
  ]);
  return { users, units };
}

export async function getSetsAdmin(actor: Actor) {
  const [sets, trays, units] = await Promise.all([
    prisma.setTemplate.findMany({
      where: { facilityId: actor.facilityId },
      include: { components: { orderBy: { sortOrder: 'asc' } }, _count: { select: { trays: true } } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.tray.findMany({
      where: { facilityId: actor.facilityId },
      include: { setTemplate: true, homeUnit: true },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    }),
    prisma.unit.findMany({ where: { facilityId: actor.facilityId, active: true }, orderBy: { code: 'asc' } }),
  ]);
  return { sets, trays, units };
}

export async function getPlacesAdmin(actor: Actor) {
  const facilityId = actor.facilityId;
  const [units, locations, devices] = await Promise.all([
    prisma.unit.findMany({ where: { facilityId }, orderBy: [{ active: 'desc' }, { code: 'asc' }] }),
    prisma.location.findMany({ where: { facilityId }, orderBy: [{ active: 'desc' }, { code: 'asc' }] }),
    prisma.device.findMany({ where: { facilityId }, orderBy: [{ active: 'desc' }, { code: 'asc' }] }),
  ]);
  return { units, locations, devices };
}
