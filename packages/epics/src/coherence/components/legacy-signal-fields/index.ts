/**
 * Hidden legacy signal fields (#2763 D5): not rendered anywhere since #2764,
 * the columns and stored values are kept. Remove once nothing reads them.
 */
export { LegacySignalFieldsDisclosure } from './legacy-signal-fields-form';
export { LegacySignalFieldsDetail } from './legacy-signal-fields-detail';
export {
  legacySignalFieldsToShow,
  type LegacySignalFieldSource,
} from './legacy-signal-fields';
