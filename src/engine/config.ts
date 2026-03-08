import { type AeginelConfig, DEFAULT_CONFIG } from './types';

export { DEFAULT_CONFIG };

export function mergeConfig(partial: Partial<AeginelConfig>): AeginelConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    layers: { ...DEFAULT_CONFIG.layers, ...partial.layers },
    pii: {
      ...DEFAULT_CONFIG.pii,
      ...partial.pii,
      types: { ...DEFAULT_CONFIG.pii.types, ...partial.pii?.types },
    },
    piiProxy: { ...DEFAULT_CONFIG.piiProxy, ...partial.piiProxy },
  };
}
