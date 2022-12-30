/* eslint-disable no-console */
import * as typeorm from 'typeorm';

import { AppDataSource, TimelineRepo } from '@app/lib/orm';
import type { Timeline } from '@app/lib/orm/entity';
import * as timeline from '@app/lib/timeline';

await AppDataSource.initialize();

let timelines: Timeline[];
let lastID = 5700001;

do {
  timelines = await TimelineRepo.find({
    take: 100,
    order: { id: 'asc' },
    where: { id: typeorm.MoreThan(lastID) },
  });

  for (const tl of timelines) {
    lastID = tl.id;
    let t;
    try {
      t = timeline.convertFromOrm(tl);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.endsWith('while unserializing payload')) {
        console.log(`bad timeline ${tl.id}`);
        continue;
      }
      throw error;
    }
    if (t) {
      timeline.validate(t);
    }
  }

  if (0 === Math.trunc(lastID / 100) % 1000) {
    console.log(lastID);
  }
} while (timelines.length > 0);

await AppDataSource.destroy();