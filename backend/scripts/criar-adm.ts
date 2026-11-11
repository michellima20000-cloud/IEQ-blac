import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/config/cryptoUtils.ts';

const prisma = new PrismaClient();

async function main() {
  const igreja = await prisma.igreja.findFirst({ where: { slug: 'ieq-sede' } });
  if (!igreja) {
    console.error('Igreja com slug "ieq-sede" não encontrada.');
    process.exit(1);
  }

  const email = 'admin@ieq.com';
  const existente = await prisma.usuario.findFirst({ where: { igreja_id: igreja.id, email } });

  const senhaHash = await hashPassword('Admin@123');

  if (existente) {
    const atualizado = await prisma.usuario.update({
      where: { id: existente.id },
      data: { perfil: 'ADM', ativo: true, senhaHash },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true }
    });
    console.log('Usuário existente promovido a ADM:', JSON.stringify(atualizado));
  } else {
    const criado = await prisma.usuario.create({
      data: {
        igreja_id: igreja.id,
        nome: 'Administrador do Sistema',
        email,
        senhaHash,
        perfil: 'ADM',
        ativo: true
      },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true }
    });
    console.log('Usuário ADM criado:', JSON.stringify(criado));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
