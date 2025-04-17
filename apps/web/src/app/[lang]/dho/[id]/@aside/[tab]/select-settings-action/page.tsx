import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectSettingsAction } from '../../../_components/select-settings-action';

export default function SelectCreateActions() {
  return (
    <SidePanel>
      <ButtonClose dropSegment="select-settings-action" />
      <SelectSettingsAction />
    </SidePanel>
  );
}
