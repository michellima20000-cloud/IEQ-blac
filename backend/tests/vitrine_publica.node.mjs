import { describe, it } from 'node:test';
import assert from 'node:assert';
import { candidatosSlug, normalizarSlug } from '../src/utils/slug.ts';
import {
  wherePublicacoesPublicadas,
  whereEventosPublicos
} from '../src/modules/midia/vitrine.publico.service.ts';
import vitrinePublicoRoutes from '../src/modules/midia/vitrine.publico.routes.ts';

describe('Etapa 6 - Vitrine Pública por Slug (link compartilhável sem login)', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';
  const IGREJA_OUTRA = 'igreja-outra-id';

  describe('1. Busca da igreja pelo identificador (slug) tolerante', () => {
    it('deve normalizar variações de escrita, caixa e separadores', () => {
      assert.strictEqual(normalizarSlug('IEQ-CIDADE NOVA'), 'ieq-cidade-nova');
      assert.strictEqual(normalizarSlug('ieq_cidade_nova'), 'ieq-cidade-nova');
      assert.strictEqual(normalizarSlug('  IEQ Cidade Nova  '), 'ieq-cidade-nova');
    });

    it('deve aceitar o slug antigo e gerar candidatos alternativos', () => {
      const candidatos = candidatosSlug('ieq-sede');
      assert.ok(candidatos.includes('ieq-sede'), 'Deve aceitar o slug antigo');
      assert.ok(candidatos.includes('ieq-cidade-nova'), 'Deve ter o slug atual como alternativa');
    });

    it('deve reconhecer o slug principal digitado com espaços e maiúsculas', () => {
      assert.ok(candidatosSlug('IEQ-CIDADE NOVA').includes('ieq-cidade-nova'));
    });
  });

  describe('2. Regra de conteúdo publicado (nada pendente/rascunho/devolvido)', () => {
    it('deve filtrar SOMENTE o conteúdo PUBLICADO da própria igreja', () => {
      const filtro = wherePublicacoesPublicadas(IGREJA_MATRIZ);
      const conteudos = [
        { id: '1', titulo: 'Banner Culto', status: 'PUBLICADO', igreja_id: IGREJA_MATRIZ },
        { id: '2', titulo: 'Aviso Retiro', status: 'PENDENTE', igreja_id: IGREJA_MATRIZ },
        { id: '3', titulo: 'Rascunho', status: 'RASCUNHO', igreja_id: IGREJA_MATRIZ },
        { id: '4', titulo: 'Devolvido', status: 'DEVOLVIDO', igreja_id: IGREJA_MATRIZ },
        { id: '5', titulo: 'Outra igreja', status: 'PUBLICADO', igreja_id: IGREJA_OUTRA }
      ];

      const publico = conteudos.filter(
        (c) => c.igreja_id === filtro.igreja_id && c.status === filtro.status
      );

      assert.strictEqual(publico.length, 1);
      assert.strictEqual(publico[0].id, '1', 'Somente o PUBLICADO da própria igreja pode ser exposto');
    });
  });

  describe('3. Regra da agenda pública (somente eventos futuros)', () => {
    it('deve considerar apenas eventos da igreja que ainda vão acontecer', () => {
      const agora = new Date('2026-11-12T12:00:00Z');
      const filtro = whereEventosPublicos(IGREJA_MATRIZ, agora);
      const eventos = [
        { id: 'e1', dataInicio: new Date('2026-11-20T19:00:00Z'), igreja_id: IGREJA_MATRIZ },
        { id: 'e2', dataInicio: new Date('2026-11-01T19:00:00Z'), igreja_id: IGREJA_MATRIZ },
        { id: 'e3', dataInicio: new Date('2026-12-05T19:00:00Z'), igreja_id: IGREJA_OUTRA }
      ];

      const futuros = eventos.filter(
        (e) => e.igreja_id === filtro.igreja_id && e.dataInicio >= filtro.dataInicio.gte
      );

      assert.strictEqual(futuros.length, 1);
      assert.strictEqual(futuros[0].id, 'e1');
    });
  });

  describe('4. Segurança da rota pública', () => {
    it('deve expor apenas a rota da vitrine, sem autenticação obrigatória', () => {
      const rotas = vitrinePublicoRoutes.stack.filter((l) => l.route);
      assert.strictEqual(rotas.length, 1, 'A rota pública deve ser única');
      assert.strictEqual(rotas[0].route.path, '/publico/vitrine/:slug');
      assert.strictEqual(rotas[0].route.stack.length, 1, 'Nenhum middleware de autenticação na rota pública');
    });

    it('NUNCA deve expor dados de células, membros, visitantes ou relatórios', () => {
      const rotas = vitrinePublicoRoutes.stack.filter((l) => l.route);
      const caminhos = rotas.map((l) => l.route.path);
      const proibidos = ['celula', 'membro', 'visitante', 'relatorio'];
      for (const caminho of caminhos) {
        for (const termo of proibidos) {
          assert.ok(
            !caminho.toLowerCase().includes(termo),
            `Rota pública não pode expor dados sensíveis: ${caminho}`
          );
        }
      }
    });
  });
});
