import { prisma } from '@/server/db';
import { actorFromUserId, type Actor } from '@/server/identity';
import type { InspectionLineInput } from '@/server/workflow';

export async function actorByUsername(username: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  const actor = await actorFromUserId(user.id);
  if (!actor) throw new Error(`Akun ${username} tidak aktif atau tidak lengkap`);
  return actor;
}

/** Hasil inspeksi lengkap dan baik untuk setiap komponen set kasus ini. */
export async function allGood(caseCode: string): Promise<InspectionLineInput[]> {
  const found = await prisma.reprocessingCase.findFirstOrThrow({
    where: { code: caseCode },
    include: { tray: { include: { setTemplate: { include: { components: true } } } } },
  });
  return found.tray.setTemplate.components.map((component) => ({ componentId: component.id, actual: component.quantity, condition: 'OK' as const }));
}

export async function expectedOf(setTemplateId: string): Promise<number> {
  const components = await prisma.setComponent.findMany({ where: { setTemplateId } });
  return components.reduce((sum, item) => sum + item.quantity, 0);
}
