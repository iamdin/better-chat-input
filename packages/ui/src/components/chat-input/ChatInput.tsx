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
        <div className="chat-input">
          <RichTextPlugin
            contentEditable={<ContentEditable className="chat-input__editable" />}
            placeholder={<div className="chat-input__placeholder">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ClearEditorPlugin />
          <SubmitPlugin onSubmit={onSubmit} enterBehavior={enterBehavior} />
        </div>
      </LexicalComposer>
    </TagProvider>
  )
}
