import type { Dayjs } from 'dayjs';

import type { Prisma } from './generated/client';
import prisma from './prisma';

/**
 * `nt_type`
 *
 * Todo 参照下面的 `_settings`
 */
export const enum Type {
  Unknown = 0,
  GroupTopicReply = 1,
  GroupPostReply = 2,
  IndexTopicReply = 3,
  IndexPostReply = 4,

  CharacterTopicReply = 5,
  CharacterPostReply = 6,
}

interface Creation {
  destUserID: number;
  sourceUserID: number;
  now: Dayjs;
  type: Type;
  /** 对应回帖所对应 post id */
  postID: number;
  /** 帖子 id, 章节 id ... */
  topicID: number;
}

/**
 * Used in transaction
 *
 * !!! 注意，数据库中的 related_id 和 回帖时的 related_id 含义不同 !!! 数据库中的 related_id 含义为回复人的新回复的 id !!! 而 mid
 * 则是帖子/章节/日志的 id
 */
export async function create(
  t: Prisma.TransactionClient,
  { destUserID, sourceUserID, now, type, postID, topicID }: Creation,
): Promise<void> {
  if (destUserID === sourceUserID) {
    return;
  }
  await t.notify.create({
    data: {
      uid: destUserID,
      from_uid: sourceUserID,
      unread: true,
      dateline: now.unix(),
      type,
      mid: postID,
      related_id: topicID,
    },
  });

  const unread = await t.notify.count({ where: { uid: destUserID, unread: true } });

  await t.members.update({
    where: { id: destUserID },
    data: { new_notify: unread },
  });
}

export async function count(userID: number): Promise<number> {
  const u = await prisma.members.findFirst({ where: { id: userID } });

  return u?.new_notify ?? 0;
}

const _settings = {
  '1': {
    url: 'SITE_URL/group/topic/',
    url_mobile: 'MOBILE_URL/topic/group/',
    anchor: '#post_',
    desc: '在你的小组话题 <a href="${url}${main_id}" class="nt_link link_${anchor}s" target="_blank">${title}s</a> 中发表了新回复',
    id: 1,
    hash: 1,
    merge: 1,
  },
  '2': {
    url: 'SITE_URL/group/topic/',
    url_mobile: 'MOBILE_URL/topic/group/',
    anchor: '#post_',
    desc: '在小组话题 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中回复了你',
    id: 2,
    hash: 1,
    merge: 1,
  },
  '3': {
    url: 'SITE_URL/subject/topic/',
    url_mobile: 'MOBILE_URL/topic/subject/',
    anchor: '#post_',
    desc: '在你的条目讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中发表了新回复',
    id: '3',
    hash: '3',
    merge: 1,
  },
  '4': {
    url: 'SITE_URL/subject/topic/',
    url_mobile: 'MOBILE_URL/topic/subject/',
    anchor: '#post_',
    desc: '在条目讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '4',
    hash: '3',
    merge: 1,
  },
  '5': {
    url: 'SITE_URL/character/',
    url_mobile: 'MOBILE_URL/topic/crt/',
    anchor: '#post_',
    desc: '在角色讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中发表了新回复',
    id: '5',
    hash: '5',
    merge: 1,
  },
  '6': {
    url: 'SITE_URL/character/',
    url_mobile: 'MOBILE_URL/topic/crt/',
    anchor: '#post_',
    desc: '在角色 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '6',
    hash: '5',
    merge: 1,
  },
  '7': {
    url: 'SITE_URL/blog/',
    anchor: '#post_',
    desc: '在你的日志 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中发表了新回复',
    id: '7',
    hash: '7',
    merge: 1,
  },
  '8': {
    url: 'SITE_URL/blog/',
    anchor: '#post_',
    desc: '在日志 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '8',
    hash: '7',
    merge: 1,
  },
  '9': {
    url: 'SITE_URL/subject/ep/',
    url_mobile: 'MOBILE_URL/topic/ep/',
    anchor: '#post_',
    desc: '在章节讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中发表了新回复',
    id: '9',
    hash: '9',
    merge: 1,
  },
  '10': {
    url: 'SITE_URL/subject/ep/',
    url_mobile: 'MOBILE_URL/topic/ep/',
    anchor: '#post_',
    desc: '在章节讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '10',
    hash: '9',
    merge: 1,
  },
  '11': {
    url: 'SITE_URL/index/',
    anchor: '#post_',
    append: '/comments',
    desc: '在目录 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中给你留言了',
    id: '11',
    hash: '11',
    merge: 1,
  },
  '12': {
    url: 'SITE_URL/index/',
    anchor: '#post_',
    append: '/comments',
    desc: '在目录 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '12',
    hash: '11',
    merge: 1,
  },
  '13': {
    url: 'SITE_URL/person/',
    url_mobile: 'MOBILE_URL/topic/prsn/',
    anchor: '#post_',
    desc: '在人物 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '13',
    hash: '13',
    merge: 1,
  },
  '14': {
    url: 'SITE_URL/user/',
    anchor: '#',
    desc: '请求与你成为好友',
    id: '14',
    hash: '14',
  },
  '15': {
    url: 'SITE_URL/user/',
    anchor: '#',
    desc: '通过了你的好友请求',
    id: '15',
    hash: '14',
  },
  '17': {
    url: 'DOUJIN_URL/club/topic/',
    anchor: '#post_',
    desc: '在你的社团讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中发表了新回复',
    id: '17',
    hash: '17',
    merge: 1,
  },
  '18': {
    url: 'DOUJIN_URL/club/topic/',
    anchor: '#post_',
    desc: '在社团讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中回复了你',
    id: '18',
    hash: '17',
    merge: 1,
  },
  '19': {
    url: 'DOUJIN_URL/subject/',
    anchor: '#post_',
    desc: '在同人作品 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中回复了你',
    id: '19',
    hash: '19',
    merge: 1,
  },
  '20': {
    url: 'DOUJIN_URL/event/topic/',
    anchor: '#post_',
    desc: '在你的展会讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中发表了新回复',
    id: '20',
    hash: '20',
    merge: 1,
  },
  '21': {
    url: 'DOUJIN_URL/event/topic/',
    anchor: '#post_',
    desc: '在展会讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中回复了你',
    id: '21',
    hash: '20',
    merge: 1,
  },
  '22': {
    url: 'SITE_URL/user/chobits_user/timeline/status/',
    anchor: '#post_',
    desc: '回复了你的 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">吐槽</a>',
    id: 22,
    hash: 22,
    merge: 1,
  },
  '23': {
    url: 'SITE_URL/group/topic/',
    url_mobile: 'MOBILE_URL/topic/group/',
    anchor: '#post_',
    desc: '在小组话题 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中提到了你',
    id: 23,
    hash: 1,
    merge: 1,
  },
  '24': {
    url: 'SITE_URL/subject/topic/',
    url_mobile: 'MOBILE_URL/topic/subject/',
    anchor: '#post_',
    desc: '在条目讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 24,
    hash: 3,
    merge: 1,
  },
  '25': {
    url: 'SITE_URL/character/',
    url_mobile: 'MOBILE_URL/topic/crt/',
    anchor: '#post_',
    desc: '在角色 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a>中提到了你',
    id: 25,
    hash: 5,
    merge: 1,
  },
  '26': {
    url: 'SITE_URL/person/',
    url_mobile: 'MOBILE_URL/topic/prsn/',
    anchor: '#post_',
    desc: '在人物讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 26,
    hash: 5,
    merge: 1,
  },
  '27': {
    url: 'SITE_URL/index/',
    anchor: '#post_',
    append: '/comments',
    desc: '在目录 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 28,
    hash: '11',
    merge: 1,
  },
  '28': {
    url: 'SITE_URL/user/chobits_user/timeline/status/',
    anchor: '#post_',
    desc: '在 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">吐槽</a> 中提到了你',
    id: 28,
    hash: 22,
    merge: 1,
  },
  '29': {
    url: 'SITE_URL/blog/',
    anchor: '#post_',
    desc: '在日志 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 29,
    hash: 7,
    merge: 1,
  },
  '30': {
    url: 'SITE_URL/subject/ep/',
    url_mobile: 'MOBILE_URL/topic/ep/',
    anchor: '#post_',
    desc: '在章节讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 30,
    hash: 9,
    merge: 1,
  },
  '31': {
    url: 'DOUJIN_URL/club/',
    anchor: '/shoutbox#post_',
    desc: '在社团 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 的留言板中提到了你',
    id: 31,
    hash: 31,
    merge: 1,
  },
  '32': {
    url: 'DOUJIN_URL/club/topic/',
    anchor: '#post_',
    desc: '在社团讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中提到了你',
    id: 32,
    hash: 17,
    merge: 1,
  },
  '33': {
    url: 'DOUJIN_URL/subject/',
    anchor: '#post_',
    desc: '在同人作品 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank"> %1$s </a> 中提到了你',
    id: 33,
    hash: '19',
    merge: 1,
  },
  '34': {
    url: 'DOUJIN_URL/event/topic/',
    anchor: '#post_',
    desc: '在展会讨论 <a href="%2$s%3$s" class="nt_link link_%4$s" target="_blank">%1$s</a> 中提到了你',
    id: 34,
    hash: 20,
    merge: 1,
  },
};
