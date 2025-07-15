import { DirectionType, Order, OrderField } from '@hypha-platform/core/client';

export const getDirection = (dir: DirectionType) => {
  return dir === DirectionType.DESC ? '-' : '+';
};

export const getOrderFromField = (field: OrderField<Document>) => {
  return `${getDirection(field.dir)}${field.name}`;
};

export const getOrder = (fields: Order<Document> | undefined) => {
  return fields
    ? fields.map((field) => getOrderFromField(field)).join(',')
    : undefined;
};
