import { SpaceRepository } from '../components/space/repository';
import { SpaceConfigRepository } from '../components/space-config/repository';
import { DocumentRepository } from '../components/governance/repository';
import { RepositoryToken } from './repository-registry';
import { PeopleRepository } from '../components';

const Config = Symbol('Config');
const SpaceRepository = Symbol(
  'SpaceRepository',
) as RepositoryToken<SpaceRepository>;

const SpaceConfigRepository = Symbol(
  'SpaceConfigRepository',
) as RepositoryToken<SpaceConfigRepository>;

const DocumentRepository = Symbol(
  'DocumentRepository',
) as RepositoryToken<DocumentRepository>;

const PeopleRepository = Symbol(
  'PeopleRepository',
) as RepositoryToken<PeopleRepository>;

const AgreementRepository = Symbol('AgreementRepository');
const MemberRepository = Symbol('MemberRepository');
const CommentRepository = Symbol('CommentRepository');

export const Tokens = {
  Config,
  SpaceRepository,
  SpaceConfigRepository,
  DocumentRepository,
  PeopleRepository,
  AgreementRepository,
  MemberRepository,
  CommentRepository,
} as const;
