'use client';

import type { ForwardedRef } from 'react';
import { useCallback, useState } from 'react';
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
  /** Anchor MDX toolbar portals (Block type, etc.) inside this wrapper so Radix popper aligns in modals/overlays. */
  const [mdxOverlayHost, setMdxOverlayHost] = useState<HTMLElement | null>(
    null,
  );
  const overlayHostRef = useCallback((node: HTMLDivElement | null) => {
    setMdxOverlayHost(node);
  }, []);

  return (
    <div className="relative">
      <MDXEditor
        className="prose max-w-full"
        overlayContainer={mdxOverlayHost ?? undefined}
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
      {/* Portal target for MDX dropdowns/tooltips — must stay in-modal for correct Radix positioning (see editor.css .richtext-editor-portal-host). */}
      <div
        ref={overlayHostRef}
        className="richtext-editor-portal-host pointer-events-none absolute inset-0 z-[60] overflow-visible"
        aria-hidden
      />
    </div>
  );
}
