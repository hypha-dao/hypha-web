import { querystring, type Querystring } from '@schemas/pagination';
import { params, type Params } from './params';
import { response, type Response } from './response';

export const schema = {
  querystring,
  params,
  response: {
    200: response,
  },
} as const;

export interface Schema {
  Params: Params;
  Reply: Response;
  Querystring: Querystring;
}
