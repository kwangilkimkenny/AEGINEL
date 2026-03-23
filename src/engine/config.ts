import { type AeginelConfig, DEFAULT_CONFIG, DEFAULT_AEGIS_SERVER_CONFIG } from './types';

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
    aegisServer: {
      ...DEFAULT_AEGIS_SERVER_CONFIG,
      ...partial.aegisServer,
      endpoints: {
        ...DEFAULT_AEGIS_SERVER_CONFIG.endpoints,
        ...partial.aegisServer?.endpoints,
      },
    },
  };
}
