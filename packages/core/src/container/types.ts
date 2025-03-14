/**
 * Symbol definitions for all injectable tokens
 */
export const SYMBOLS = {
  // Database connections
  Database: {
    AdminConnection: Symbol('Database.AdminConnection'),
    UserConnection: Symbol('Database.UserConnection'),
  },

  // Repository symbols
  Repositories: {
    // Main repositories
    SpaceRepository: Symbol('SpaceRepository'),
    SpaceConfigRepository: Symbol('SpaceConfigRepository'),
    DocumentRepository: Symbol('DocumentRepository'),
    PeopleRepository: Symbol('PeopleRepository'),

    // Additional repositories
    AgreementRepository: Symbol('AgreementRepository'),
    MemberRepository: Symbol('MemberRepository'),
    CommentRepository: Symbol('CommentRepository'),
  },
};
