/**
 * Build the people-transactions API URL. A present `token` (including
 * invalid values) is always forwarded so the route stays scoped.
 */
export function buildUserTransfersEndpoint({
  personSlug,
  sort,
  token,
}: {
  personSlug: string;
  sort?: string;
  token?: string;
}): string {
  const params = new URLSearchParams();
  if (sort) {
    params.set('sort', sort);
  }
  if (token != null) {
    params.set('token', token);
  }
  const query = params.toString();
  return query
    ? `/api/v1/people/${personSlug}/transactions?${query}`
    : `/api/v1/people/${personSlug}/transactions`;
}
