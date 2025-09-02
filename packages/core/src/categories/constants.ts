import { Category } from './types';

export type CategoryOption = {
  value: Category;
  label: string;
  archive: boolean;
};

export const categories = [
  // archived categories for backward compatibility
  {
    value: 'art',
    label: 'Art',
    archive: true,
  },
  {
    value: 'events',
    label: 'Events',
    archive: true,
  },
  // actual categories
  {
    value: 'arts',
    label: 'Arts',
    archive: false,
  },
  {
    value: 'biodiversity',
    label: 'Biodiversity',
    archive: false,
  },
  {
    value: 'bioregions',
    label: 'Bioregions',
    archive: false,
  },
  {
    value: 'cities',
    label: 'Cities',
    archive: false,
  },
  {
    value: 'culture',
    label: 'Culture',
    archive: false,
  },
  {
    value: 'education',
    label: 'Education',
    archive: false,
  },
  {
    value: 'emergency',
    label: 'Emergency',
    archive: false,
  },
  {
    value: 'energy',
    label: 'Energy',
    archive: false,
  },
  {
    value: 'finance',
    label: 'Finance',
    archive: false,
  },
  {
    value: 'food',
    label: 'Food',
    archive: false,
  },
  {
    value: 'gaming',
    label: 'Gaming',
    archive: false,
  },
  {
    value: 'governance',
    label: 'Governance',
    archive: false,
  },
  {
    value: 'health',
    label: 'Health',
    archive: false,
  },
  {
    value: 'housing',
    label: 'Housing',
    archive: false,
  },
  {
    value: 'innovation',
    label: 'Innovation',
    archive: false,
  },
  {
    value: 'knowledge',
    label: 'Knowledge',
    archive: false,
  },
  {
    value: 'land',
    label: 'Land',
    archive: false,
  },
  {
    value: 'media',
    label: 'Media',
    archive: false,
  },
  {
    value: 'mobility',
    label: 'Mobility',
    archive: false,
  },
  {
    value: 'networks',
    label: 'Networks',
    archive: false,
  },
  {
    value: 'ocean',
    label: 'Ocean',
    archive: false,
  },
  {
    value: 'distribution',
    label: 'Distribution',
    archive: false,
  },
  {
    value: 'goods',
    label: 'Goods',
    archive: false,
  },
  {
    value: 'services',
    label: 'Services',
    archive: false,
  },
  {
    value: 'sport',
    label: 'Sport',
    archive: false,
  },
  {
    value: 'tech',
    label: 'Tech',
    archive: false,
  },
  {
    value: 'tourism',
    label: 'Tourism',
    archive: false,
  },
  {
    value: 'villages',
    label: 'Villages',
    archive: false,
  },
  {
    value: 'water',
    label: 'Water',
    archive: false,
  },
  {
    value: 'wellbeing',
    label: 'Wellbeing',
    archive: false,
  },
] as const satisfies readonly CategoryOption[];
