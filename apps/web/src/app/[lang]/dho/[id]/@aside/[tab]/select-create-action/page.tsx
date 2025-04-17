import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectCreateAction } from '../../../_components/select-create-action';

export default function SelectCreateActions() {
  return (
    <SidePanel>
      <ButtonClose dropSegment="select-create-action" />
      <SelectCreateAction />
    </SidePanel>
  );
}
