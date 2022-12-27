import type { Static } from '@sinclair/typebox';
import { Type as t } from '@sinclair/typebox';

import { NotAllowedError } from 'app/lib/auth';
import { BadRequestError, NotFoundError } from 'app/lib/error';
import { Security, Tag } from 'app/lib/openapi';
import * as orm from 'app/lib/orm';
import { requireLogin } from 'app/lib/rest/hooks/pre-handler';
import type { App } from 'app/lib/rest/type';
import * as Subject from 'app/lib/subject';
import { InvalidWikiSyntaxError, SandBox } from 'app/lib/subject';
import * as res from 'app/lib/types/res';
import { formatErrors } from 'app/lib/types/res';

const exampleSubjectEdit = {
  name: '沙盒',
  infobox: `{{Infobox animanga/TVAnime
|中文名= 沙盒
|别名={
}
|话数= 7
|放送开始= 0000-10-06
|放送星期= 
|官方网站= 
|播放电视台= 
|其他电视台= 
|播放结束= 
|其他= 
|Copyright= 
|平台={
[龟壳]
[Xbox Series S]
[Xbox Series X]
[Xbox Series X/S]
[PC]
[Xbox Series X|S]
}
}}`,
  platform: 0,
  summary: `本条目是一个沙盒，可以用于尝试bgm功能。

普通维基人可以随意编辑条目信息以及相关关联查看编辑效果，但是请不要完全删除沙盒说明并且不要关联非沙盒条目/人物/角色。

https://bgm.tv/group/topic/366812#post_1923517`,
};

export type ISubjectEdit = Static<typeof SubjectEdit>;
export const SubjectEdit = t.Object(
  {
    name: t.String({ minLength: 1 }),
    infobox: t.String({ minLength: 1 }),
    platform: t.Integer(),
    summary: t.String(),
  },
  {
    examples: [exampleSubjectEdit],
    $id: 'SubjectEdit',
  },
);

// eslint-disable-next-line @typescript-eslint/require-await
export async function setup(app: App) {
  app.addSchema(res.Error);
  app.addSchema(SubjectEdit);

  app.put(
    '/subjects/:subjectID',
    {
      schema: {
        tags: [Tag.Wiki],
        operationId: 'putSubjectInfo',
        description: `暂时只能修改沙盒条目 ${[...SandBox].sort().join(',')}`,
        params: t.Object({
          subjectID: t.Integer({ examples: [363612], minimum: 0 }),
        }),
        security: [{ [Security.CookiesSession]: [] }],
        body: t.Object(
          {
            commitMessage: t.String({ minLength: 1 }),
            subject: t.Ref(SubjectEdit),
          },
          {
            examples: [
              {
                commitMessage: '修正笔误',
                subject: exampleSubjectEdit,
              },
            ],
          },
        ),
        response: {
          200: t.Null(),
          401: t.Ref(res.Error, {
            'x-examples': formatErrors(InvalidWikiSyntaxError()),
          }),
        },
      },
      preHandler: [requireLogin('editing a subject info')],
    },
    async ({
      auth,
      body: { commitMessage, subject: input },
      params: { subjectID },
    }): Promise<void> => {
      if (!auth.permission.subject_edit) {
        throw new NotAllowedError('edit subject');
      }

      const s = await orm.fetchSubject(subjectID);
      if (!s) {
        throw new NotFoundError(`subject ${subjectID}`);
      }

      if (s.locked) {
        throw new NotAllowedError('edit a locked subject');
      }

      const body: Static<typeof SubjectEdit> = input;

      await Subject.edit({
        subjectID: subjectID,
        name: body.name,
        infobox: body.infobox,
        platform: body.platform,
        summary: body.summary,
        userID: auth.userID,
        commitMessage,
      });
    },
  );

  app.patch(
    '/subjects/:subjectID',
    {
      schema: {
        tags: [Tag.Wiki],
        operationId: 'patchSubjectInfo',
        description: `暂时只能修改沙盒条目 ${[...SandBox].sort().join(',')}`,
        params: t.Object({
          subjectID: t.Integer({ examples: [363612], minimum: 0 }),
        }),
        security: [{ [Security.CookiesSession]: [] }],
        body: t.Object(
          {
            commitMessage: t.String({ minLength: 1 }),
            subject: t.Partial(SubjectEdit, { $id: undefined }),
          },
          {
            examples: [
              {
                commitMessage: '修正笔误',
                subject: { infobox: exampleSubjectEdit.infobox },
              },
            ],
          },
        ),
        response: {
          200: t.Null(),
          401: t.Ref(res.Error, {
            'x-examples': formatErrors(InvalidWikiSyntaxError()),
          }),
        },
      },
      preHandler: [requireLogin('editing a subject info')],
    },
    async ({
      auth,
      body: { commitMessage, subject: input },
      params: { subjectID },
    }): Promise<void> => {
      if (!auth.permission.subject_edit) {
        throw new NotAllowedError('edit subject');
      }

      if (Object.keys(input).length === 0) {
        return;
      }

      const s = await orm.fetchSubject(subjectID);
      if (!s) {
        throw new BadRequestError(`subject ${subjectID}`);
      }

      if (s.locked) {
        throw new NotAllowedError('edit a locked subject');
      }

      const {
        infobox = s.infobox,
        name = s.name,
        platform = s.platform,
        summary = s.summary,
      }: Partial<Static<typeof SubjectEdit>> = input;

      if (
        infobox === s.infobox &&
        name === s.name &&
        platform === s.platform &&
        summary === s.summary
      ) {
        // no new data
        return;
      }

      await Subject.edit({
        subjectID: subjectID,
        name: name,
        infobox: infobox,
        commitMessage: commitMessage,
        platform: platform,
        summary: summary,
        userID: auth.userID,
      });
    },
  );
}
