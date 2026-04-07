import type { Document as DbDocument, Person, Space } from '../schema';
import type { Document, CreatorType, DocumentState } from './type';

export interface DocumentWithCreator extends Document {
  creator?: CreatorType;
}

export function mapToDocument(
  dbDocument: DbDocument,
  personCreator?: Person | null,
  spaceCreator?: Space | null,
): DocumentWithCreator {
  let actualCreator: CreatorType | undefined;

  const isInviteSpace = dbDocument.title === 'Invite Space';

  if (isInviteSpace && spaceCreator) {
    actualCreator = {
      avatarUrl: spaceCreator.logoUrl || '',
      name: spaceCreator.title || '',
      surname: '',
      type: 'space',
    };
  } else if (personCreator) {
    actualCreator = {
      avatarUrl: personCreator.avatarUrl || '',
      name: personCreator.name || '',
      surname: personCreator.surname || '',
      type: 'person',
    };
  } else if (spaceCreator) {
    actualCreator = {
      avatarUrl: spaceCreator.logoUrl || '',
      name: spaceCreator.title || '',
      surname: '',
      type: 'space',
    };
  }

  return {
    id: dbDocument.id,
    creatorId: dbDocument.creatorId,
    title: dbDocument.title ?? '',
    description: dbDocument.description ?? undefined,
    slug: dbDocument.slug ?? '',
    state: dbDocument.state as DocumentState,
    leadImage: dbDocument.leadImage || '',
    attachments: dbDocument.attachments || [],
    createdAt: dbDocument.createdAt,
    updatedAt: dbDocument.updatedAt,
    web3ProposalId: dbDocument.web3ProposalId,
    creator: actualCreator,
    label: dbDocument.label || '',
  };
}
