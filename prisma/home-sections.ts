import { prisma } from "../src/lib/prisma.js";
import {
  SINGLETON_DEFAULT_TITLES,
  SINGLETON_SECTION_TYPES,
} from "../src/lib/home-singletons.js";

export const ensureHomeSections = async () => {
  let linked = 0;
  let created = 0;
  const duplicates: { type: string; id: string }[] = [];

  for (const type of SINGLETON_SECTION_TYPES) {
    const sections = await prisma.homeSection.findMany({
      where: { type },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, singletonKey: true },
    });

    const keeper =
      sections.find((section) => section.singletonKey === type) ??
      sections[0];

    if (!keeper) {
      const last = await prisma.homeSection.aggregate({
        _max: { sortOrder: true },
      });

      await prisma.homeSection.create({
        data: {
          type,
          singletonKey: type,
          title: SINGLETON_DEFAULT_TITLES[type],
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
      });

      created += 1;
      continue;
    }

    if (keeper.singletonKey !== type) {
      await prisma.homeSection.update({
        where: { id: keeper.id },
        data: { singletonKey: type },
      });

      linked += 1;
    }

    for (const extra of sections) {
      if (extra.id !== keeper.id) duplicates.push({ type, id: extra.id });
    }
  }

  console.log(
    `Home sections: ${linked} linked, ${created} created, ${duplicates.length} duplicate(s)`,
  );

  for (const duplicate of duplicates) {
    console.warn(
      `Duplicate ${duplicate.type} section (${duplicate.id}): delete it manually in Prisma Studio.`,
    );
  }
};