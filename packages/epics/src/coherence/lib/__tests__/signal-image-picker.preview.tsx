import { createRoot } from 'react-dom/client';
import React from 'react';
import { SignalImagePicker } from '../../components/signal-image-picker';

function Demo() {
  const [files, setFiles] = React.useState<File[]>([]);
  return (
    <SignalImagePicker
      label="Images"
      hint="JPEG, PNG, WebP, or GIF"
      accept="image/png,image/jpeg,.png,.jpg,.jpeg"
      maxFiles={8}
      maxBytes={16 * 1024 * 1024}
      files={files}
      kept={[]}
      onFilesChange={setFiles}
      onKeptChange={() => undefined}
    />
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Demo />);
