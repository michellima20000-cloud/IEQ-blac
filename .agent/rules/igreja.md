# REGRAS DO PROJETO (sempre seguir)

- Back-end e front-end são projetos separados (/backend e /frontend). O front só fala com o back pela API REST.
- Toda permissão e todo isolamento entre igrejas (igreja_id) são validados no back-end.
- Perfil Mídia nunca acessa dados de células, membros ou relatórios.
- Armazenamento: MinIO local + cópia na nuvem (R2 ou B2). Nenhum serviço pago.
- Fotos de célula são apagadas automaticamente após o prazo (padrão 60 dias), do local e da nuvem. O relatório fica.
- Tudo roda em Docker (docker-compose).
- Escrever testes das regras de permissão a cada etapa.
- Antes de rodar comandos destrutivos ou apagar arquivos, pedir confirmação.
- Responder e documentar (README) em português.

