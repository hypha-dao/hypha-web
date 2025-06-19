import { DirectionType, Order, OrderField } from '@hypha-platform/core/server';
import { Document } from '@core/governance';

export const getDirection = (value: string) => {
  let dir: DirectionType = DirectionType.ASC;
  switch (value) {
    case '-':
      dir = DirectionType.DESC;
      break;
    case '+':
    default:
      dir = DirectionType.ASC;
      break;
  }
  return dir;
};

export const getOrder = (orderString: string | undefined): Order<Document> => {
  const order: Order<Document> = [];
  if (orderString) {
    orderString
      .split(',')
      .map((fieldName) => fieldName.trim())
      .filter((fieldName) => fieldName.length > 0)
      .forEach((fieldName) => {
        const match = /^([+-]?)(\w+)$/.exec(fieldName);
        if (match) {
          const dir = getDirection(match[1]);
          const name = match[2] as keyof Document;
          const orderField: OrderField<Document> = { dir, name };
          order.push(orderField);
        }
      });
  }
  return order;
};
