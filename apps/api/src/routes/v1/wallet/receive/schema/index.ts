import { querystring, type Querystring } from './querystring';
import { response, type Response } from './response';

export const schema = {
  querystring,
  response,
} as const;

export interface Schema {
  Reply: Response;
  Querystring: Querystring;
}
