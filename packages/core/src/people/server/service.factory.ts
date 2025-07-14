import { createRequestScope } from '../../_container';
import { PeopleService } from './service';

type CreatePeopleServiceProps = {
  authToken?: string;
};

export const createPeopleService = ({
  authToken,
}: CreatePeopleServiceProps = {}) => {
  const requestContainer = createRequestScope({ authToken });
  return requestContainer.get(PeopleService);
};
