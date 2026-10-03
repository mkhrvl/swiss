import type {
  ApiKeyOptions,
  JwtKeyOptions,
  RandomPasswordOptions,
} from '../state/secret-generation';
import type { JsonOptions } from '@swiss/core/json';
export type WorkspaceInput =
  | { tool: 'json'; text: string; options: JsonOptions }
  | { tool: 'base64'; text: string }
  | { tool: 'ocr'; dataUrl: string }
  | { tool: 'identity-hash'; password: string }
  | { tool: 'identity-verify'; password: string; hash: string }
  | { tool: 'bcrypt-hash'; password: string; cost: string }
  | { tool: 'bcrypt-verify'; password: string; hash: string }
  | { tool: 'api-key'; options: ApiKeyOptions }
  | { tool: 'jwt-key'; options: JwtKeyOptions }
  | { tool: 'random-password'; options: RandomPasswordOptions };
export type Message =
  | { kind: 'take-input'; windowId?: number; token?: string }
  | { kind: 'input-ready'; windowId: number; token: string }
  | { kind: 'open-tab'; input?: WorkspaceInput }
  | { kind: 'capture'; windowId: number };
export function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    ['take-input', 'input-ready', 'open-tab', 'capture'].includes(
      String(value.kind),
    )
  );
}
