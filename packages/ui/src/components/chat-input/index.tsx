// Headless chat input: atomic pieces you compose inside your own
// <LexicalComposer>. There is no <ChatInput> god-component — mount <ChatContent>,
// <Triggers>, your useTrigger hosts, and useSubmit, and register your EntityNode
// subclasses in initialConfig.nodes.

export { ChatContent } from './chat-content'
export type { ChatContentProps } from './chat-content'

export { Triggers } from './trigger-composer/triggers'
export { useTrigger } from './trigger-composer/use-trigger'
export type {
  TriggerSlot,
  TriggerItems,
  UseTriggerConfig,
} from './trigger-composer/use-trigger'
export type { CascadeLevel } from './trigger-composer/context'
export { useTypeaheadKeyboard } from './trigger-composer/use-typeahead-keyboard'
export type { TypeaheadKeyboardHandlers } from './trigger-composer/use-typeahead-keyboard'
export type {
  PendingSelect,
  SelectResult,
  TriggerEditorAPI,
} from './trigger-composer/apply-select-result'
export type { CharMatchConfig } from './trigger/match'

export { EntityNode, createEntity, $isEntityNode } from './entity/entity-node'
export type { SerializedEntity } from './entity/entity-node'

export { useSubmit, registerSubmit } from './plugins/submit-plugin'
export type { SubmitOptions } from './plugins/submit-plugin'

export { serializeEditorState } from './serializer/serialize'
export type { SubmitPayload, Entity, ImagePayload, FilePayload } from './serializer/types'
export { SUBMIT_COMMAND } from './commands'
