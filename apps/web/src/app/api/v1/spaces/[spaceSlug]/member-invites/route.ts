import {
  createSpaceMemberInvite,
  getAbsoluteAppUrl,
  getSpaceDhoPath,
  resolveMemberCaller,
} from '@hypha-platform/core/server';
import { routing, type Locale } from '@hypha-platform/i18n';
import { sendEmailNotifications } from '@hypha-platform/notifications/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const inviteBodySchema = z.object({
  personId: z.number().int().positive(),
  lang: z.string().optional(),
});

function inviteLocale(value: string | undefined): Locale {
  if (value && (routing.locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return routing.defaultLocale;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ spaceSlug: string }> },
) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { spaceSlug } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = inviteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
  }

  try {
    const caller = await resolveMemberCaller(authToken);
    if (!caller?.person.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await createSpaceMemberInvite(
      {
        spaceSlug,
        inviterPersonId: caller.person.id,
        inviterAddress: caller.person.address,
        inviteePersonId: parsed.data.personId,
      },
      { db: caller.db },
    );

    if (!result.ok) {
      const status =
        result.reason === 'space-not-found' ||
        result.reason === 'invitee-not-found'
          ? 404
          : result.reason === 'not-member'
          ? 403
          : result.reason === 'membership-unknown'
          ? 503
          : 409;
      return NextResponse.json(
        { error: 'Invite was not sent', reason: result.reason },
        { status },
      );
    }

    let emailed = false;
    if (result.invite.inviteeSlug) {
      const lang = inviteLocale(parsed.data.lang);
      const path = `${getSpaceDhoPath(
        result.invite.spaceSlug,
        'overview',
        lang,
      )}?invite=${encodeURIComponent(result.invite.token)}`;
      const url = getAbsoluteAppUrl(path);
      const title = result.invite.spaceTitle
        .replace(/[\r\n]+/g, ' ')
        .slice(0, 120);
      const safeTitle = escapeHtml(title);
      const safeUrl = escapeHtml(url);
      try {
        const sent = await sendEmailNotifications({
          usernames: [result.invite.inviteeSlug],
          subject: `Invitation to join ${title}`,
          body: `<p>You are invited to join ${safeTitle}.</p><p><a href="${safeUrl}">Open the space and join</a></p>`,
        });
        emailed = sent != null;
      } catch (error) {
        console.error('[space-member-invite] email failed', error);
      }
    }

    return NextResponse.json({
      id: result.invite.id,
      spaceSlug: result.invite.spaceSlug,
      spaceTitle: result.invite.spaceTitle,
      alreadyPending: result.invite.alreadyPending,
      emailed,
    });
  } catch (error) {
    console.error('Error creating space invite:', error);
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 },
    );
  }
}
