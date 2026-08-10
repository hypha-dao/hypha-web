export interface Person {
  id: number;
  name?: string;
  surname?: string;
  email?: string;
  slug?: string;
  sub?: string;
  avatarUrl?: string;
  leadImageUrl?: string;
  description?: string;
  location?: string;
  nickname?: string;
  address?: string;
  /** ISO 4217 code balances are shown in. Undefined means USD. */
  preferredCurrency?: string;
  links?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GetPersonByIdInput {
  id?: number;
}

export interface GetPersonBySubInput {
  sub?: string;
}

export interface EditPersonInput {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  id: number;
  nickname?: string;
  description?: string;
  leadImageUrl?: string;
}
