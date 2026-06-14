import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect, useRef, type ReactNode } from 'react'
import type { LexicalEditor } from 'lexical'
import { TagNode } from './tag/TagNode'
import { TagProvider } from './tag/TagProvider'
import { useTagRenderer } from './tag/use-tag-renderer'
import type { TagRenderer } from './tag/TagProvider'
import { SubmitPlugin } from './plugins/SubmitPlugin'
import { TriggerComposer } from './trigger-composer/TriggerComposer'
import type { CharMatchConfig } from './trigger/match'
import type { SubmitPayload } from './serializer/types'

export interface TagRendererSpec {
  tagType: string
  render: TagRenderer
}

export interface ChatInputProps {
  onSubmit: (payload: SubmitPayload) => void
  enterBehavior?: 'submit' | 'newline'
  placeholder?: string
  tagRenderers?: TagRendererSpec[]
  /**
   * Trigger plugins (e.g. <UserMentionPlugin />) rendered inside the
   * TriggerComposer. Each self-registers its source — there is no config array.
   */
  children?: ReactNode
  /** Per-char query matching shared across sources of that char (spec §4.6). */
  charConfig?: Record<string, CharMatchConfig>
  /** Exposes the underlying editor once mounted (used by demos and E2E tests). */
  onReady?: (editor: LexicalEditor) => void
}

function RegisterOne({ spec }: { spec: TagRendererSpec }): null {
  useTagRenderer(spec.tagType, spec.render)
  return null
}

function OnReady({ onReady }: { onReady?: ChatInputProps['onReady'] }): null {
  const [editor] = useLexicalComposerContext()
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    onReady?.(editor)
  }, [editor, onReady])
  return null
}

function TagRenderers({ specs }: { specs: TagRendererSpec[] }): ReactNode {
  return (
    <>
      {specs.map((spec) => (
        <RegisterOne key={spec.tagType} spec={spec} />
      ))}
    </>
  )
}

export function ChatInput({
  onSubmit,
  enterBehavior = 'submit',
  placeholder = '',
  tagRenderers = [],
  children,
  charConfig,
  onReady,
}: ChatInputProps) {
  return (
    <TagProvider>
      <LexicalComposer
        initialConfig={{
          namespace: 'chat-input',
          nodes: [TagNode],
          onError: (error) => {
            throw error
          },
        }}
      >
        <TagRenderers specs={tagRenderers} />
        <OnReady onReady={onReady} />
        <div className="relative rounded-md border border-input bg-transparent text-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
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
          <SubmitPlugin enterBehavior={enterBehavior} onSubmit={onSubmit} />
          <TriggerComposer charConfig={charConfig}>{children}</TriggerComposer>
        </div>
      </LexicalComposer>
    </TagProvider>
  )
}
