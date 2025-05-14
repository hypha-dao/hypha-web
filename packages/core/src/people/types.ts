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
