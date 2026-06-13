import type { SerializedEditorState } from 'lexical'

export interface TagEntity {
  tagType: string
  data: Record<string, unknown>
}

export interface ImagePayload {
  src: string
  alt?: string
  file?: File
}

export interface FilePayload {
  path: string
  name: string
  mimeType?: string
}

export interface SubmitPayload {
  /** Plain text; each tag is one ￼ (U+FFFC) placeholder. */
  text: string
  /** Structured tags, in document order; entities[i] is the i-th ￼ in text. */
  entities: TagEntity[]
  images: ImagePayload[]
  files: FilePayload[]
  isEmpty: boolean
  editorStateJSON?: SerializedEditorState
}
