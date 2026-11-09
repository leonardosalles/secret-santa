# Amigo Secreto

Use PNPM 10.33.3 e configure as variáveis Firebase da `.env.example` na `.env.local`.

```sh
pnpm install
pnpm run dev
```

## Modo teste

Defina `NEXT_PUBLIC_TEST_MODE=true` na `.env.local` e reinicie o servidor. Os dois sorteios ficam liberados antes de 05/12 e podem ser repetidos. O app continua lendo os participantes reais, mas não grava sorteios, preferências ou senhas no Firebase. Os resultados de teste ficam apenas na memória da página e somem ao recarregar.

Para voltar ao modo normal, use `NEXT_PUBLIC_TEST_MODE=false`. Em produção, refaça o build após alterar a variável, pois variáveis `NEXT_PUBLIC_*` são incorporadas ao código do navegador.

## Histórico de quem começa

No modo normal, cada sorteio cria um documento em `editions/{NEXT_PUBLIC_APP_YEAR}/starterDraws/{id}`, sem sobrescrever os anteriores. Ele contém o ano, ID e nome do participante, avatar, autor (`drawnBy`) e data do servidor (`createdAt`). A página recupera o registro mais recente da edição ao abrir.

As regras do Firestore precisam permitir a leitura e criação desses registros para o acesso utilizado pelo app. O histórico usa o mesmo banco configurado em `NEXT_PUBLIC_FIREBASE_DATABASE_ID` (padrão: `(default)`).

O ano da edição é definido por `NEXT_PUBLIC_APP_YEAR`. Fora do modo teste, os sorteios abrem em 05/12 desse ano, às 00h de Brasília.

## Verificação

```sh
pnpm run test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

## Privacidade dos pares

O campo `users/{id}.picked` passa a guardar um objeto cifrado com RSA-OAEP/SHA-256, vinculado ao participante e à edição. A chave pública fica em `drawIdentity.publicKey`; a chave privada fica cifrada com AES-256-GCM e uma chave derivada da senha por PBKDF2-SHA-256 (600.000 iterações, salt aleatório). A senha e a chave privada aberta não são gravadas no Firebase. O hash de login usa outro salt e não serve como chave de decriptação.

Todos precisam entrar novamente uma vez, fora do modo teste, para preparar suas chaves. A chave privada desbloqueada fica no `sessionStorage` da própria aba e é removida ao sair. Sem essa sessão, é necessário entrar com a senha novamente. Não há chave mestra nem recuperação administrativa do resultado se a senha/chave for perdida.

No primeiro sorteio real, uma transação gera e cifra todos os pares e cria o marcador `editions/{ano}/draws/secret`. Os próximos acessos apenas abrem o resultado existente, sem refazer o sorteio. Todos os IDs sorteados são únicos e ninguém tira a si mesmo. Participantes adicionados depois não entram automaticamente numa edição já sorteada.

Resultados antigos em texto aberto são preservados como pares fixos e migrados juntos nessa primeira transação, depois que todos tiverem suas chaves. Se os dados antigos tiverem conflitos ou não permitirem completar o sorteio, a operação falha sem alterar resultados. Até essa migração, os valores antigos ainda são legíveis no banco. Eles não são apagados de backups, exportações ou cópias anteriores. O app não realiza uma migração em produção durante o desenvolvimento.

**Limite da proteção:** isto protege a leitura do banco em repouso. Não prova sigilo contra o dono da aplicação: quem controla o código pode capturar senhas, trocar chaves ou inspecionar os pares durante a geração no navegador que inicia o sorteio. Senhas fracas continuam sujeitas a tentativas offline. A autenticação atual por cookie e as regras do Firestore também não foram substituídas por esta mudança. Para uma garantia contra o organizador ativo, é necessário um sorteador independente ou protocolo distribuído auditado.

As regras do Firestore precisam permitir a transação que atualiza `picked` dos participantes e cria o marcador da edição, além da preparação de `drawIdentity` no login. Essas regras não são alteradas automaticamente pelo app.
