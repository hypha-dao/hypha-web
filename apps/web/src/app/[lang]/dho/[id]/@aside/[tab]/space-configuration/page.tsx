import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectSettingsAction } from '../../../_components/select-settings-action';

export default function SpaceConfiguration() {
  return (
    <SidePanel>
      <ButtonClose dropSegment="space-configuration" />
      <div>Space Configuration</div>
    </SidePanel>
  );
}
