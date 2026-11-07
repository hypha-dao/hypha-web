// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddAttachment } from '@hypha-platform/ui';
import { SignalImagePicker } from '../../components/signal-image-picker';

afterEach(() => {
  cleanup();
});

function assignFiles(input: HTMLInputElement, files: File[]) {
  const list = Object.assign([...files], {
    item: (index: number) => files[index] ?? null,
  });
  Object.defineProperty(input, 'files', {
    configurable: true,
    get: () => list,
  });
  fireEvent.change(input);
}

function Picker() {
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

describe('SignalImagePicker', () => {
  it('opens the single file input on the first click and again for reselection', () => {
    const view = render(<Picker />);
    const button = view.getByRole('button', { name: 'Images' });
    const inputs = view.container.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(1);
    const input = inputs[0] as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(view.container.querySelector('[class~="sr-only"]')).toBeTruthy();
    expect(view.queryByRole('button', { name: /JPEG/ })).toBeNull();

    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);

    assignFiles(input, [new File(['a'], 'one.png', { type: 'image/png' })]);
    expect(view.getByText('one.png')).toBeTruthy();
    expect(view.container.querySelectorAll('input[type="file"]')).toHaveLength(
      1,
    );

    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(2);
    assignFiles(input, [
      new File(['b'], 'two.png', { type: 'image/png' }),
      new File(['c'], 'notes.pdf', { type: 'application/pdf' }),
    ]);
    expect(view.getByText('one.png')).toBeTruthy();
    expect(view.getByText('two.png')).toBeTruthy();
    expect(view.queryByText('notes.pdf')).toBeNull();
  });

  it('drops a file larger than the byte limit', () => {
    const view = render(
      <SignalImagePicker
        label="Images"
        hint="JPEG, PNG, WebP, or GIF"
        accept="image/png"
        maxFiles={8}
        maxBytes={8}
        files={[]}
        kept={[]}
        onFilesChange={() => undefined}
        onKeptChange={() => undefined}
      />,
    );
    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    assignFiles(input, [
      new File([new Uint8Array(32)], 'big.png', { type: 'image/png' }),
    ]);
    expect(view.queryByText('big.png')).toBeNull();
  });

  it('keeps the attachment list hidden when the dialog is cancelled', () => {
    const view = render(<Picker />);
    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(view.getByRole('button', { name: 'Images' }));
    expect(
      view.getByTestId('signal-image-picker').querySelector('.sr-only'),
    ).toBeTruthy();
    expect(view.queryByText('one.png')).toBeNull();
  });

  it('leaves the shared uploader trigger in place for other callers', () => {
    const view = render(
      <AddAttachment
        label="Add a document"
        accept="application/pdf,.pdf"
        onChange={() => undefined}
      />,
    );
    const trigger = view.getByRole('button', { name: 'Add a document' });
    const input = view.container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(view.container.querySelectorAll('input[type="file"]')).toHaveLength(
      1,
    );
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    fireEvent.click(trigger);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('signal-image-picker')).toBeNull();
  });
});
