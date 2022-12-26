import dayjs from 'dayjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppDataSource, SubjectRevRepo } from 'app/lib/orm';
import * as entity from 'app/lib/orm/entity';

import * as Subject from './subject';
import { SubjectType } from './subject';

describe('should update subject', () => {
  const subjectMock = vi.fn();
  const subjectRevMock = vi.fn();

  vi.spyOn(AppDataSource, 'transaction')
    // @ts-expect-error test, ignore type error
    .mockImplementation(async <T = unknown>(fn: (t: any) => Promise<T>): Promise<T> => {
      return await fn({
        getRepository(t: unknown) {
          if (t === entity.Subject) {
            return {
              update: subjectMock,
              findOneByOrFail() {
                return Promise.resolve({ typeID: SubjectType.Anime });
              },
            };
          }

          if (t == entity.SubjectRev) {
            return { insert: subjectRevMock };
          }

          throw new Error('unexpected entity');
        },
      });
    });

  beforeEach(async () => {
    await SubjectRevRepo.delete({ subjectID: 363612 });
  });

  test('should update subject', async () => {
    const now = dayjs();

    await Subject.edit({
      subjectID: 363612,
      name: 'q',
      infobox: '{{Infobox q }}',
      summary: 'summary summary 2',
      userID: 2,
      platform: 3,
      commitMessage: 'cm',
      now,
    });

    expect(subjectRevMock).toBeCalledWith({
      commitMessage: 'cm',
      createdAt: now.unix(),
      creatorID: 2,
      infobox: '{{Infobox q }}',
      name: 'q',
      nameCN: '',
      platform: 3,
      subjectID: 363612,
      summary: 'summary summary 2',
      typeID: SubjectType.Anime,
    });

    expect(subjectMock).toBeCalledWith(
      {
        id: 363612,
      },
      {
        fieldEps: 0,
        fieldInfobox: '{{Infobox q }}',
        fieldSummary: 'summary summary 2',
        name: 'q',
        nameCN: '',
        platform: 3,
        updatedAt: now.unix(),
      },
    );
  });
});
