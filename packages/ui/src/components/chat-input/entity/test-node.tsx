import type { DOMConversionMap, LexicalNode } from 'lexical'
import { EntityNode, createEntity, type SerializedEntity } from './entity-node'

// Shared fixtures for headless tests — concrete EntityNode subclasses exactly as a
// consuming app would write them. Not exported from the package index.

interface UserData {
  id?: string
  name: string
}

export class UserNode extends EntityNode<UserData> {
  static getType(): string {
    return 'user'
  }
  static clone(node: UserNode): UserNode {
    return new UserNode(node.__data, node.__key)
  }
  static importJSON(json: SerializedEntity<UserData>): UserNode {
    return $createUserNode(json.data)
  }
  static importDOM(): DOMConversionMap {
    return EntityNode.importDOMFor('user', (data) => $createUserNode(data as unknown as UserData))
  }
  override getTextContent(): string {
    return `@${this.__data.name}`
  }
  decorate(): never {
    throw new Error('decorate is exercised in the browser, not headless tests')
  }
}
export const $createUserNode = (data: UserData): UserNode => createEntity(UserNode, data)
export const $isUserNode = (node: LexicalNode | null | undefined): node is UserNode =>
  node instanceof UserNode

interface FileData {
  id?: string
  name: string
  path?: string
}

export class FileNode extends EntityNode<FileData> {
  static getType(): string {
    return 'file'
  }
  static clone(node: FileNode): FileNode {
    return new FileNode(node.__data, node.__key)
  }
  static importJSON(json: SerializedEntity<FileData>): FileNode {
    return $createFileNode(json.data)
  }
  override getTextContent(): string {
    return this.__data.path ?? this.__data.name
  }
  decorate(): never {
    throw new Error('decorate is exercised in the browser, not headless tests')
  }
}
export const $createFileNode = (data: FileData): FileNode => createEntity(FileNode, data)
