import { PrismaClient, Perfil, StatusRelatorio, TipoMidia, StatusMidia } from '@prisma/client';
import { hashPassword } from '../src/config/cryptoUtils.ts';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Iniciando Seed do Banco de Dados...');

  // Gera hash real da senha padrão usando scrypt nativo (sem dependências externas)
  const senhaHash = await hashPassword('Pastor@123');
  const senhaHashAdmin = await hashPassword('Admin@123');
  console.log('🔐 Hash gerado com sucesso.');

  // Limpeza prévia
  await prisma.logAuditoria.deleteMany();
  await prisma.configuracaoIgreja.deleteMany();
  await prisma.eventoCalendario.deleteMany();
  await prisma.conteudoMidia.deleteMany();
  await prisma.relatorioCelula.deleteMany();
  await prisma.visitante.deleteMany();
  await prisma.membro.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.celula.deleteMany();
  await prisma.rede.deleteMany();
  await prisma.igreja.deleteMany();

  // 1. Igreja Principal
  const igrejaMatriz = await prisma.igreja.create({
    data: {
      nome: 'Igreja do Evangelho Quadrangular - Sede',
      slug: 'ieq-sede',
      configuracao: {
        create: {
          prazoRetencaoFotosDias: 60
        }
      }
    }
  });

  // 2. Igreja Secundária (para testes de isolamento)
  const igrejaOutra = await prisma.igreja.create({
    data: {
      nome: 'IEQ - Bairro Norte',
      slug: 'ieq-bairro-norte',
      configuracao: {
        create: {
          prazoRetencaoFotosDias: 30
        }
      }
    }
  });

  // 3. Redes da Igreja Matriz
  const redeJovens = await prisma.rede.create({
    data: {
      nome: 'Rede de Jovens - Radicais Livres',
      igreja_id: igrejaMatriz.id
    }
  });

  const redeFamilia = await prisma.rede.create({
    data: {
      nome: 'Rede da Família',
      igreja_id: igrejaMatriz.id
    }
  });

  // 4. Células (2 em Jovens, 2 em Família)
  const celulaJovens1 = await prisma.celula.create({
    data: {
      nome: 'Célula Metanóia (Jovens 1)',
      diaSemana: 'Sábado',
      horario: '19:30',
      endereco: 'Rua das Flores, 120',
      redeId: redeJovens.id,
      igreja_id: igrejaMatriz.id
    }
  });

  const celulaJovens2 = await prisma.celula.create({
    data: {
      nome: 'Célula Dunamis (Jovens 2)',
      diaSemana: 'Sexta-feira',
      horario: '20:00',
      endereco: 'Av. Central, 450',
      redeId: redeJovens.id,
      igreja_id: igrejaMatriz.id
    }
  });

  const celulaFamilia1 = await prisma.celula.create({
    data: {
      nome: 'Célula Betel (Família 1)',
      diaSemana: 'Quarta-feira',
      horario: '20:00',
      endereco: 'Rua Primavera, 88',
      redeId: redeFamilia.id,
      igreja_id: igrejaMatriz.id
    }
  });

  const celulaFamilia2 = await prisma.celula.create({
    data: {
      nome: 'Célula Koinonia (Família 2)',
      diaSemana: 'Quinta-feira',
      horario: '19:30',
      endereco: 'Rua Nova Aliança, 301',
      redeId: redeFamilia.id,
      igreja_id: igrejaMatriz.id
    }
  });

  // 5. Usuários - 1 de cada perfil na Igreja Matriz
  const administrador = await prisma.usuario.create({
    data: {
      nome: 'Administrador do Sistema',
      email: 'admin@ieq.com',
      senhaHash: senhaHashAdmin,
      perfil: Perfil.ADM,
      igreja_id: igrejaMatriz.id
    }
  });

  const pastor = await prisma.usuario.create({
    data: {
      nome: 'Pastor Titular',
      email: 'pastor@ieq.com',
      senhaHash,
      perfil: Perfil.PASTOR,
      igreja_id: igrejaMatriz.id
    }
  });

  const liderRedeJovens = await prisma.usuario.create({
    data: {
      nome: 'Líder Rede Jovens',
      email: 'rede.jovens@ieq.com',
      senhaHash,
      perfil: Perfil.REDE,
      redeId: redeJovens.id,
      igreja_id: igrejaMatriz.id
    }
  });

  const liderCelulaJovens1 = await prisma.usuario.create({
    data: {
      nome: 'Líder Célula Metanóia',
      email: 'celula.jovens1@ieq.com',
      senhaHash,
      perfil: Perfil.CELULA,
      redeId: redeJovens.id,
      celulaId: celulaJovens1.id,
      igreja_id: igrejaMatriz.id
    }
  });

  const midia = await prisma.usuario.create({
    data: {
      nome: 'Equipe de Mídia',
      email: 'midia@ieq.com',
      senhaHash,
      perfil: Perfil.MIDIA,
      igreja_id: igrejaMatriz.id
    }
  });

  // Usuário de outra igreja (para testes de isolamento)
  const pastorOutraIgreja = await prisma.usuario.create({
    data: {
      nome: 'Pastor Outra Igreja',
      email: 'pastor.norte@ieq.com',
      senhaHash,
      perfil: Perfil.PASTOR,
      igreja_id: igrejaOutra.id
    }
  });

  console.log('✅ Seed executado com sucesso:');
  console.log(` - Igreja Matriz: ${igrejaMatriz.id} (${igrejaMatriz.nome})`);
  console.log(` - Igreja Outra: ${igrejaOutra.id} (${igrejaOutra.nome})`);
  console.log(` - Administrador (ADM): ${administrador.email}`);
  console.log(` - Pastor: ${pastor.email}`);
  console.log(` - Líder de Rede: ${liderRedeJovens.email}`);
  console.log(` - Líder de Célula: ${liderCelulaJovens1.email}`);
  console.log(` - Mídia: ${midia.email}`);
  console.log(` - Pastor Outra Igreja: ${pastorOutraIgreja.email}`);
}

if (process.env.NODE_ENV !== 'test') {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

