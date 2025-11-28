import { Button, ConfirmDialog } from '@hypha-platform/ui';

export const ExitSpace = () => {
  return (
    <>
      <ConfirmDialog
        title="Exit Space"
        description="Do you really want to exit this space?"
        customAcceptButtonText="Yes, leave"
        customRejectButtonText="No, stay"
        onAcceptClicked={() => {
          console.log('Accepted Exit Space');
        }}
        onRejectClicked={() => {
          console.log('Rejected Exit Space');
        }}
      >
        <Button colorVariant="neutral" variant="outline">
          Exit Space
        </Button>
      </ConfirmDialog>
    </>
  );
};
