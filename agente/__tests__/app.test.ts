import { afterEach, describe, expect, it } from '@jest/globals';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { elicitacao, fakeHost, reservaFeita, sequentialIds, TRACEPARENT } from './helpers/fakes.js';

let app: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (app ? app.close(() => resolve()) : resolve()));
});

describe('createApp', () => {
  it('fecha a ponte de ponta a ponta sem vazar o requestState', async () => {
    const host = fakeHost([elicitacao(['sala-fusca', 'sala-mirante']), reservaFeita('sala-mirante')]);
    app = createApp({ publicUrl: 'http://localhost:7300', host, ids: sequentialIds(), log: () => undefined });
    await new Promise<void>((resolve) => app!.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
    const rpc = async (id: number, method: string, params: unknown) => {
      const r = await fetch(`${url}/a2a`, { method: 'POST', headers: { 'content-type': 'application/json', traceparent: TRACEPARENT }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
      return { bruto: await r.clone().text(), json: (await r.json()) as any };
    };

    const card = await (await fetch(`${url}/.well-known/agent-card.json`)).json();
    expect(card.supportedInterfaces[0].url).toBe('http://localhost:7300/a2a');

    const pedido = 'reservar sala=sala-garagem inicio=2026-11-03T14:00:00-03:00 fim=2026-11-03T15:00:00-03:00 responsavel=Marty';
    const pausa = await rpc(1, 'SendMessage', { message: { messageId: 'm1', role: 'ROLE_USER', parts: [{ text: pedido }] } });
    expect(pausa.json.result.task.status.message.parts[0].text).toBe('alternativas: sala-fusca, sala-mirante');

    const fim = await rpc(2, 'SendMessage', { message: { messageId: 'm2', role: 'ROLE_USER', parts: [{ text: 'escolha=sala-mirante' }], taskId: 'task-1' } });
    expect(fim.json.result.task.status.state).toBe('TASK_STATE_COMPLETED');

    const lida = await rpc(3, 'GetTask', { id: 'task-1' });
    expect(lida.json.result.task.artifacts[0].name).toBe('reserva');
    for (const corpo of [pausa.bruto, fim.bruto, lida.bruto]) expect(corpo).not.toContain('estado-opaco');
  });
});
