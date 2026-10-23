import { describe, expect, it } from '@jest/globals';
import { buildAgentCard } from '../../src/a2a/agent-card.js';

describe('buildAgentCard', () => {
  it('declara a interface JSON-RPC 1.0 e a skill reservar-sala', () => {
    const card = buildAgentCard('http://localhost:7300');
    expect(card.supportedInterfaces).toEqual([{ url: 'http://localhost:7300/a2a', protocolBinding: 'JSONRPC', protocolVersion: '1.0' }]);
    expect(card.skills.map((s) => s.id)).toEqual(['reservar-sala']);
    expect(card.capabilities).toEqual({ streaming: false, pushNotifications: false, extendedAgentCard: false });
    expect(card).not.toHaveProperty('preferredTransport');
  });
});
