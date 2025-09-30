import {
  DonutChartResponse,
  AreaChartResponse,
  BarChartResponse,
  LineChartResponse,
} from '../types/v1/generated';

export const donutChartMock: DonutChartResponse = {
  id: 101,
  space_id: 202,
  range: '1W',
  title: 'Donut Chart',
  type: DonutChartResponse.type.STATISTICS,
  total: 5000,
  groups: [
    { label: 'Alpha', percentage: 25 },
    { label: 'Beta', percentage: 35 },
    { label: 'Gamma', percentage: 20 },
    { label: 'Delta', percentage: 20 },
  ],
};

export const areaChartMock: AreaChartResponse = {
  id: 102,
  space_id: 203,
  range: '1M',
  group_by: 'day',
  current_value: 1200,
  change_percent: 15,
  type: AreaChartResponse.type.STATISTICS,
  data: [
    { timestamp: '2023-11-01T00:00:00Z', value: 200 },
    { timestamp: '2023-11-02T00:00:00Z', value: 250 },
    { timestamp: '2023-11-03T00:00:00Z', value: 300 },
    { timestamp: '2023-11-04T00:00:00Z', value: 150 },
    { timestamp: '2023-11-05T00:00:00Z', value: 100 },
    { timestamp: '2023-11-06T00:00:00Z', value: 100 },
    { timestamp: '2023-11-07T00:00:00Z', value: 100 },
  ],
};

export const barChartMock: BarChartResponse = {
  id: 103,
  space_id: 204,
  range: '1M',
  group_by: 'week',
  type: BarChartResponse.type.REVENUE,
  data: [
    { timestamp: '2023-10-08T00:00:00Z', subscriptions: 10 },
    { timestamp: '2023-10-15T00:00:00Z', subscriptions: 20 },
    { timestamp: '2023-10-22T00:00:00Z', subscriptions: 15 },
    { timestamp: '2023-10-29T00:00:00Z', subscriptions: 25 },
  ],
};

export const lineChartMock: LineChartResponse = {
  id: 104,
  space_id: 205,
  range: '1Y',
  group_by: 'month',
  type: LineChartResponse.type.STATISTICS,
  data: [
    { timestamp: '2023-01-01T00:00:00Z', members: 100, community: 50 },
    { timestamp: '2023-02-01T00:00:00Z', members: 120, community: 60 },
    { timestamp: '2023-03-01T00:00:00Z', members: 140, community: 70 },
    { timestamp: '2023-04-01T00:00:00Z', members: 160, community: 80 },
    { timestamp: '2023-05-01T00:00:00Z', members: 180, community: 90 },
    { timestamp: '2023-06-01T00:00:00Z', members: 200, community: 100 },
    { timestamp: '2023-07-01T00:00:00Z', members: 220, community: 110 },
    { timestamp: '2023-08-01T00:00:00Z', members: 240, community: 120 },
    { timestamp: '2023-09-01T00:00:00Z', members: 260, community: 130 },
    { timestamp: '2023-10-01T00:00:00Z', members: 280, community: 140 },
    { timestamp: '2023-11-01T00:00:00Z', members: 300, community: 150 },
    { timestamp: '2023-12-01T00:00:00Z', members: 320, community: 160 },
  ],
};
