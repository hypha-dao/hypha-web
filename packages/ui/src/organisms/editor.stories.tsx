import type { Meta, StoryObj } from '@storybook/react';

import { RichTextEditor } from './editor';

const meta = {
  component: RichTextEditor,
  title: 'UI/Organisms/Editor',
} satisfies Meta<typeof RichTextEditor>;

export default meta;

type Story = StoryObj<typeof RichTextEditor>;

export const Default: Story = {
  args: {
    editorRef: null,
    markdown:
      'Hello, world!\n\n- [ ] List item 1\n- [ ] List item 2\n- [x] List item 3',
  },
};
