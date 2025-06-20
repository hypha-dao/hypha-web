import { Document } from '@core/governance';
import { DirectionType, Order, OrderField } from '../types';

export const getDirection = (dir: DirectionType) => {
  let result: string = '';
  switch (dir) {
    case DirectionType.DESC:
      result = '-';
      break;
    case DirectionType.ASC:
    default:
      result = '+';
      break;
  }
  return result;
};

export const getOrderFromField = (field: OrderField<Document>) => {
  return `${getDirection(field.dir)}${field.name}`;
};

export const getOrder = (fields: Order<Document> | undefined) => {
  return fields
    ? fields.map((field) => getOrderFromField(field)).join(',')
    : undefined;
};
