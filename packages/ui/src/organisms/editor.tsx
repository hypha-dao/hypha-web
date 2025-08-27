'use client';

import type { ForwardedRef } from 'react';
import {
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  UndoRedo,
  BoldItalicUnderlineToggles,
  ListsToggle,
  linkPlugin,
  BlockTypeSelect,
} from '@mdxeditor/editor';
import { Separator } from '../separator';

import '@mdxeditor/editor/style.css';
import './editor.css';

export function RichTextEditor({
  editorRef,
  ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
  return (
    <MDXEditor
      className="prose max-w-full"
      plugins={[
        toolbarPlugin({
          toolbarContents: () => (
            <div className="flex gap-1 grow text-lg">
              <BlockTypeSelect />
              <Separator orientation="vertical" />
              <BoldItalicUnderlineToggles />
              <Separator orientation="vertical" />
              <ListsToggle options={['bullet', 'number']} />
              <div className="grow" />
              <UndoRedo />
            </div>
          ),
        }),
        headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        linkPlugin(),
      ]}
      {...props}
      ref={editorRef}
    />
  );
}
