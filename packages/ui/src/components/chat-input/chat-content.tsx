import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { ReactNode } from 'react'

export interface ChatContentProps {
  placeholder?: ReactNode
  /** Extra classes merged onto the editable wrapper. */
  className?: string
}

/**
 * The editable surface: the styled wrapper + RichText/History/Clear plugins. A
 * pure rendering atom — mount it inside your own `<LexicalComposer>`, as a
 * sibling of `<Triggers>`. It owns no trigger or submit behaviour; compose those
 * with `useTrigger` / `useSubmit`.
 */
export function ChatContent({ placeholder = '', className }: ChatContentProps) {
  return (
    <div
      className={`relative rounded-lg border border-input bg-background text-sm shadow-xs/5 transition-[color,box-shadow] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/6%)] focus-within:border-ring focus-within:shadow-none focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/32 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]${
        className ? ` ${className}` : ''
      }`}
    >
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="min-h-20 w-full px-3 py-2 outline-none" />
        }
        placeholder={
          <div className="pointer-events-none absolute left-3 top-2 select-none text-muted-foreground">
            {placeholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ClearEditorPlugin />
    </div>
  )
}
