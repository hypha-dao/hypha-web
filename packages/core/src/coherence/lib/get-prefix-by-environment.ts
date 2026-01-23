export function getPrefixByEnvironment(environment: string) {
  switch (environment) {
    case 'delevopment':
      return 'dev';
    case 'preview':
      return 'prev';
    case 'production':
      return 'prod';
    default:
      return 'prod';
  }
}
