export const SKILL_RESERVAR_SALA = 'reservar-sala';
export const A2A_PATH = '/a2a';
export const AGENT_CARD_PATH = '/.well-known/agent-card.json';

export function buildAgentCard(publicUrl: string) {
  return {
    name: 'Central de Salas',
    description: 'Reserva salas de reuniao da Hill Valley Tech.',
    provider: { organization: 'Hill Valley Tech', url: 'https://hillvalley.example' },
    version: '1.0.0',
    supportedInterfaces: [{ url: new URL(A2A_PATH, publicUrl).href, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    skills: [
      {
        id: SKILL_RESERVAR_SALA,
        name: 'Reservar sala',
        description: 'Reserva uma sala em um intervalo. Se houver conflito, pergunta qual alternativa usar.',
        tags: ['salas', 'agenda'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
        examples: [
          'reservar sala=sala-garagem inicio=2026-11-03T14:00:00-03:00 fim=2026-11-03T15:00:00-03:00 responsavel=Marty',
        ],
      },
    ],
  };
}
