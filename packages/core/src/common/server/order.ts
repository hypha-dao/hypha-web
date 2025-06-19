import {
  DirectionType,
  Document,
  Order,
  OrderField,
} from '@hypha-platform/core/server';

export const getDirection = (value: string) => {
  let dir: DirectionType = DirectionType.Asc;
  switch (value) {
    case '-':
      dir = DirectionType.Desc;
      break;
    case '+':
    default:
      dir = DirectionType.Asc;
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
