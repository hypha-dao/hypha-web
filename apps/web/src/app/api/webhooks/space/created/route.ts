import { Alchemy, findPersonByWeb3Address } from '@hypha-platform/core/server';
import { daoSpaceFactoryImplementationAbi } from '@hypha-platform/core/generated';
import {
  sendEmailByAlias,
  sendPushByAlias,
} from '@hypha-platform/notifications/server';
import { db } from '@hypha-platform/storage-postgres';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_SPACE_CREATED_SIGN_KEY;
      if (!key) throw new Error('Missing key for space created webhook');

      return key;
    })(),
    abi: daoSpaceFactoryImplementationAbi,
    event: 'SpaceCreated',
  },
  async (events) => {
    const creatorsWithTotalOfSpaces = events.reduce((creators, { args }) => {
      const creator = args.creator.toLowerCase() as `0x${string}`;
      creators[creator] = (creators[creator] || 0) + 1;

      return creators;
    }, {} as Record<`0x${string}`, number>);

    const dbRequestForCreators = Object.entries(creatorsWithTotalOfSpaces).map(
      async ([address, spaces]) => {
        const person = await findPersonByWeb3Address({ address }, { db });
        if (!person) throw new Error(`Empty person for address ${address}`);

        return { ...person, createdSpacesCount: spaces };
      },
    );
    const dbResponse = await Promise.allSettled(dbRequestForCreators);

    dbResponse.forEach((res) => {
      if (res.status === 'rejected')
        console.error('Failed to fetch person:', res.reason);
    });

    const creatorsToNotify = dbResponse
      .filter((res) => res.status === 'fulfilled')
      .map(({ value }) => value);
    if (creatorsToNotify.length === 0) {
      const spaceIds = events.map(({ args }) => args.spaceId);
      console.warn(
        'No creators found to notify. Space IDs from logs:',
        spaceIds,
      );

      return;
    }

    const notifyParams = creatorsToNotify.map(
      ({ slug, createdSpacesCount }) => ({
        slug,
        header: 'Successful space creation',
        body:
          createdSpacesCount > 1
            ? `You've successfully created ${createdSpacesCount} spaces.`
            : "You've successfully created a space.",
      }),
    );
    const sendingEmails = notifyParams.map(
      async ({ slug, header, body }) =>
        await sendEmailByAlias({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
          alias: {
            include_aliases: {
              external_id: [slug!],
            },
          },
          content: {
            email_subject: header,
            email_body: body,
          },
        }),
    );
    const sendingPushes = notifyParams.map(
      async ({ slug, header, body }) =>
        await sendPushByAlias({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '',
          alias: {
            include_aliases: {
              external_id: [slug!],
            },
          },
          content: {
            contents: { en: body },
            headings: { en: header },
          },
        }),
    );

    const notifying = Promise.allSettled(sendingEmails.concat(sendingPushes));
    (await notifying)
      .filter((notification) => notification.status === 'rejected')
      .forEach(({ reason }) => console.error(reason));
  },
);
