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
import { PasteMarkdown } from './paste-markdown';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { Separator } from '../separator';
import { AsteriskBold, UnderscoreUnderline } from './chat-markdown-marks';

import './editor.css';

const EDITOR_CONTENT_CLASS =
  'richtext-editor-content prose max-w-full focus:outline-none';

export type EditorTranslationFn = (
  key: string,
  defaultValue: string | undefined,
  interpolations?: Record<string, string | number>,
) => string;

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

function applyInterpolations(
  template: string,
  interpolations?: Record<string, string | number>,
): string {
  if (!interpolations) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    interpolations[name] !== undefined
      ? String(interpolations[name])
      : `{${name}}`,
  );
}

function translateLabel(
  translation: EditorTranslationFn | undefined,
  key: string,
  defaultValue: string,
  interpolations?: Record<string, string | number>,
): string {
  const result = translation
    ? translation(key, defaultValue, interpolations)
    : defaultValue;
  // Fill placeholders when translation is absent or returned the raw default.
  return applyInterpolations(result, interpolations);
}

export interface ToolbarButtonProps
  extends Omit<
    ComponentPropsWithoutRef<typeof Button>,
    'children' | 'type' | 'variant' | 'colorVariant' | 'size'
  > {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
  tabIndex?: number;
  onFocus?: () => void;
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    {
      onClick,
      active,
      disabled,
      label,
      children,
      tabIndex,
      onFocus,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        colorVariant="neutral"
        size="sm"
        data-toolbar-item=""
        className={cn(
          'h-8 w-8 shrink-0 p-0',
          active && 'bg-accent-4 text-accent-12 hover:bg-accent-5',
          className,
        )}
        aria-label={label}
        title={label}
        aria-pressed={active}
        disabled={disabled}
        tabIndex={tabIndex}
        onFocus={onFocus}
        {...props}
        onClick={(e) => {
          // Forward the event so Radix (PopoverTrigger asChild) can read
          // defaultPrevented; type="button" already avoids form submit.
          onClick?.(e);
        }}
        onMouseDown={(e) => {
          // Keep editor selection when clicking toolbar.
          e.preventDefault();
          props.onMouseDown?.(e);
        }}
      >
        {children}
      </Button>
    );
  },
);

interface LinkToolbarControlProps {
  editor: Editor;
  translation?: EditorTranslationFn;
  tabIndex?: number;
  onFocus?: () => void;
  active: boolean;
}

function LinkToolbarControl({
  editor,
  translation,
  tabIndex,
  onFocus,
  active,
}: LinkToolbarControlProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const linkLabel = translateLabel(translation, 'toolbar.link', 'Link');
  const urlLabel = translateLabel(translation, 'toolbar.linkUrl', 'URL');
  const applyLabel = translateLabel(translation, 'toolbar.applyLink', 'Apply');
  const removeLabel = translateLabel(
    translation,
    'toolbar.removeLink',
    'Remove link',
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setUrl(String(editor.getAttributes('link').href ?? ''));
    }
    setOpen(next);
  };

  const applyLink = () => {
    const href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else if (editor.state.selection.empty && !active) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton
          label={linkLabel}
          active={active}
          tabIndex={tabIndex}
          onFocus={onFocus}
        >
          <Link2 className="h-4 w-4" aria-hidden />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 space-y-3 p-3"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>{urlLabel}</Label>
          <Input
            ref={inputRef}
            id={inputId}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            size="sm"
            disabled={!active}
            onClick={removeLink}
          >
            {removeLabel}
          </Button>
          <Button
            type="button"
            colorVariant="accent"
            size="sm"
            onClick={applyLink}
          >
            {applyLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EditorToolbarProps {
  editor: Editor;
  translation?: EditorTranslationFn;
}

function EditorToolbar({ editor, translation }: EditorToolbarProps) {
  const [tabbableIndex, setTabbableIndex] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

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
          isLink: false,
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
        isLink: ed.isActive('link'),
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

  // Undo is 11 and Redo is 12. Move the tab stop off a disabled control.
  const resolvedTabbableIndex =
    (tabbableIndex === 11 && !state.canUndo) ||
    (tabbableIndex === 12 && !state.canRedo)
      ? 0
      : tabbableIndex;

  const itemTabIndex = (index: number) =>
    index === resolvedTabbableIndex ? 0 : -1;

  const itemFocus = (index: number) => () => setTabbableIndex(index);

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

    const items = Array.from(
      toolbarRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[data-toolbar-item]',
      ) ?? [],
    );
    if (items.length === 0) return;

    event.preventDefault();
    const current = items.findIndex((el) => el === document.activeElement);
    const start = current >= 0 ? current : resolvedTabbableIndex;
    const step = event.key === 'ArrowRight' ? 1 : -1;

    for (let offset = 1; offset <= items.length; offset += 1) {
      const next = (start + step * offset + items.length) % items.length;
      if (!items[next]?.disabled) {
        setTabbableIndex(next);
        items[next]?.focus();
        break;
      }
    }
  };

  const isApple =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const undoShortcut = isApple ? '⌘Z' : 'Ctrl+Z';
  const redoShortcut = isApple ? '⇧⌘Z' : 'Ctrl+Y';

  return (
    <div
      ref={toolbarRef}
      className="richtext-editor-toolbar flex flex-wrap items-center gap-0.5 border-b border-border bg-neutral-2 px-2 py-1.5"
      role="toolbar"
      aria-label={translateLabel(
        translation,
        'toolbar.ariaLabel',
        'Formatting',
      )}
      onKeyDown={handleToolbarKeyDown}
    >
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.blockTypes.paragraph',
          'Paragraph',
        )}
        active={state.headingLevel === 0}
        tabIndex={itemTabIndex(0)}
        onFocus={itemFocus(0)}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Type className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.blockTypes.heading',
          'Heading {level}',
          { level: 1 },
        )}
        active={state.headingLevel === 1}
        tabIndex={itemTabIndex(1)}
        onFocus={itemFocus(1)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.blockTypes.heading',
          'Heading {level}',
          { level: 2 },
        )}
        active={state.headingLevel === 2}
        tabIndex={itemTabIndex(2)}
        onFocus={itemFocus(2)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.blockTypes.heading',
          'Heading {level}',
          { level: 3 },
        )}
        active={state.headingLevel === 3}
        tabIndex={itemTabIndex(3)}
        onFocus={itemFocus(3)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.blockTypes.heading',
          'Heading {level}',
          { level: 4 },
        )}
        active={state.headingLevel === 4}
        tabIndex={itemTabIndex(4)}
        onFocus={itemFocus(4)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label={translateLabel(translation, 'toolbar.bold', 'Bold')}
        active={state.isBold}
        tabIndex={itemTabIndex(5)}
        onFocus={itemFocus(5)}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(translation, 'toolbar.italic', 'Italic')}
        active={state.isItalic}
        tabIndex={itemTabIndex(6)}
        onFocus={itemFocus(6)}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(translation, 'toolbar.underline', 'Underline')}
        active={state.isUnderline}
        tabIndex={itemTabIndex(7)}
        onFocus={itemFocus(7)}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.bulletedList',
          'Bullet list',
        )}
        active={state.isBulletList}
        tabIndex={itemTabIndex(8)}
        onFocus={itemFocus(8)}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(
          translation,
          'toolbar.numberedList',
          'Numbered list',
        )}
        active={state.isOrderedList}
        tabIndex={itemTabIndex(9)}
        onFocus={itemFocus(9)}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <LinkToolbarControl
        editor={editor}
        translation={translation}
        active={state.isLink}
        tabIndex={itemTabIndex(10)}
        onFocus={itemFocus(10)}
      />

      <div className="grow" />

      <ToolbarButton
        label={translateLabel(translation, 'toolbar.undo', 'Undo {shortcut}', {
          shortcut: undoShortcut,
        })}
        disabled={!state.canUndo}
        tabIndex={itemTabIndex(11)}
        onFocus={itemFocus(11)}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={translateLabel(translation, 'toolbar.redo', 'Redo {shortcut}', {
          shortcut: redoShortcut,
        })}
        disabled={!state.canRedo}
        tabIndex={itemTabIndex(12)}
        onFocus={itemFocus(12)}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}

export interface RichTextEditorProps {
  /** Controlled markdown value stored in forms / API. */
  markdown?: string;
  /** Called with markdown whenever the document changes. */
  onChange?: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  /** Set false when a parent already renders the frame. */
  bordered?: boolean;
  /** Accessible name for the editing region. */
  'aria-label'?: string;
  /** Id of an existing label element that names the editing region. */
  'aria-labelledby'?: string;
  /**
   * Optional ref to the TipTap editor instance.
   * Kept for call sites that previously passed MDXEditor refs (usually `null`).
   */
  editorRef?: ForwardedRef<Editor | null> | null;
  /**
   * i18n hook for toolbar labels. Uses English defaults when omitted or when
   * a key is missing from the consumer dictionary.
   */
  translation?: EditorTranslationFn;
}

export function RichTextEditor({
  markdown = '',
  onChange,
  placeholder,
  className,
  editable = true,
  bordered = true,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  editorRef,
  translation,
}: RichTextEditorProps) {
  const lastEmittedMarkdown = useRef(markdown);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const resolvedAriaLabel =
    ariaLabel ??
    translateLabel(translation, 'editor.ariaLabel', 'Rich text editor');

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    content: markdown,
    contentType: 'markdown',
    extensions: [
      StarterKit.configure({
        // Replaced by AsteriskBold / UnderscoreUnderline for chat-compatible __/ **.
        bold: false,
        underline: false,
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          markdownLinks: true,
          linkOnPaste: true,
        },
      }),
      AsteriskBold,
      UnderscoreUnderline,
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
      Markdown,
      PasteMarkdown,
    ],
    editorProps: {
      attributes: {
        class: EDITOR_CONTENT_CLASS,
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabelledBy
          ? { 'aria-labelledby': ariaLabelledBy }
          : { 'aria-label': resolvedAriaLabel }),
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

  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'placeholder',
    );
    if (!ext) return;
    ext.options.placeholder = placeholder ?? '';
    editor.view.dispatch(editor.state.tr);
  }, [editor, placeholder]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: EDITOR_CONTENT_CLASS,
          role: 'textbox',
          'aria-multiline': 'true',
          ...(ariaLabelledBy
            ? { 'aria-labelledby': ariaLabelledBy }
            : { 'aria-label': resolvedAriaLabel }),
        },
      },
    });
  }, [editor, ariaLabelledBy, resolvedAriaLabel]);

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
      data-bordered={bordered ? 'true' : 'false'}
    >
      {editor && editable ? (
        <EditorToolbar editor={editor} translation={translation} />
      ) : null}
      <EditorContent editor={editor} className="richtext-editor-content-host" />
    </div>
  );
}
