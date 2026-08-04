'use client';

import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from '@tiptap/react';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, type ForwardedRef, type ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { Button } from '../button';
import { Separator } from '../separator';

import './editor.css';

function assignEditorRef(
  editorRef: ForwardedRef<Editor | null> | null | undefined,
  editor: Editor | null,
) {
  if (!editorRef) return;
  if (typeof editorRef === 'function') {
    editorRef(editor);
    return;
  }
  editorRef.current = editor;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      colorVariant="neutral"
      size="sm"
      className={cn(
        'h-8 w-8 shrink-0 p-0',
        active && 'bg-accent-4 text-accent-12 hover:bg-accent-5',
      )}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseDown={(e) => {
        // Keep editor focus when clicking toolbar.
        e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) {
        return {
          isBold: false,
          isItalic: false,
          isUnderline: false,
          isBulletList: false,
          isOrderedList: false,
          headingLevel: 0 as 0 | 1 | 2 | 3 | 4,
          canUndo: false,
          canRedo: false,
        };
      }
      return {
        isBold: ed.isActive('bold'),
        isItalic: ed.isActive('italic'),
        isUnderline: ed.isActive('underline'),
        isBulletList: ed.isActive('bulletList'),
        isOrderedList: ed.isActive('orderedList'),
        headingLevel: (ed.isActive('heading', { level: 1 })
          ? 1
          : ed.isActive('heading', { level: 2 })
          ? 2
          : ed.isActive('heading', { level: 3 })
          ? 3
          : ed.isActive('heading', { level: 4 })
          ? 4
          : 0) as 0 | 1 | 2 | 3 | 4,
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
      };
    },
  });

  return (
    <div
      className="richtext-editor-toolbar flex flex-wrap items-center gap-0.5 border-b border-border bg-neutral-2 px-2 py-1.5"
      role="toolbar"
      aria-label="Formatting"
    >
      <ToolbarButton
        label="Paragraph"
        active={state.headingLevel === 0}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Type className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 1"
        active={state.headingLevel === 1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.headingLevel === 2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.headingLevel === 3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 4"
        active={state.headingLevel === 4}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Bold"
        active={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={state.isUnderline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label="Bullet list"
        active={state.isBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.isOrderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <div className="grow" />

      <ToolbarButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}

export type RichTextEditorProps = {
  /** Controlled markdown value stored in forms / API. */
  markdown?: string;
  /** Called with markdown whenever the document changes. */
  onChange?: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  /**
   * Optional ref to the TipTap editor instance.
   * Kept for call sites that previously passed MDXEditor refs (usually `null`).
   */
  editorRef?: ForwardedRef<Editor | null> | null;
  /**
   * Legacy MDXEditor i18n hook. Accepted as no-op so existing form props
   * continue to type-check during migration; TipTap uses aria-labels instead.
   */
  translation?: (
    key: string,
    defaultValue: string | undefined,
    interpolations?: Record<string, string | number>,
  ) => string;
};

export function RichTextEditor({
  markdown = '',
  onChange,
  placeholder,
  className,
  editable = true,
  editorRef,
}: RichTextEditorProps) {
  const lastEmittedMarkdown = useRef(markdown);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    content: markdown,
    contentType: 'markdown',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
      Markdown,
    ],
    editorProps: {
      attributes: {
        class: 'richtext-editor-content prose max-w-full focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = ed.getMarkdown();
      lastEmittedMarkdown.current = next;
      onChangeRef.current?.(next);
    },
  });

  useEffect(() => {
    assignEditorRef(editorRef, editor);
    return () => assignEditorRef(editorRef, null);
  }, [editor, editorRef]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // Sync external markdown (form reset / resubmit) without stomping local typing.
  useEffect(() => {
    if (!editor) return;
    if (markdown === lastEmittedMarkdown.current) return;
    const current = editor.getMarkdown();
    if (current === markdown) {
      lastEmittedMarkdown.current = markdown;
      return;
    }
    editor.commands.setContent(markdown, {
      contentType: 'markdown',
      emitUpdate: false,
    });
    lastEmittedMarkdown.current = markdown;
  }, [editor, markdown]);

  return (
    <div
      className={cn(
        'richtext-editor relative overflow-hidden rounded-[inherit]',
        className,
      )}
      data-editable={editable ? 'true' : 'false'}
    >
      {editor ? <EditorToolbar editor={editor} /> : null}
      <EditorContent editor={editor} className="richtext-editor-content-host" />
    </div>
  );
}
