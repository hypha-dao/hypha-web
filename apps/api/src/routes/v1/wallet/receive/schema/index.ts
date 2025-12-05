import { querystring, type Querystring } from './querystring';
import { response, type Response } from './response';

export const schema = {
  querystring,
  response: {
    200: response,
    '4xx': { $ref: 'HttpError' },
    '5xx': { $ref: 'HttpError' },
  },
} as const;

export interface Schema {
  Reply: Response;
  Querystring: Querystring;
}
