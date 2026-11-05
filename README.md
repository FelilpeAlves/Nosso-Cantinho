# Nosso Cantinho ♡

Aplicativo de tarefas da casa para **Felipe e Aline**. Instalável como aplicativo no Android e no iPhone, com um visual aconchegante, tarefas por cômodo, recorrência, agradecimentos, backup e **sincronização opcional em tempo real entre os dois celulares**.

## O que funciona agora

- Modo local sem login e sem cadastro: as tarefas continuam salvas no próprio aparelho.
- Modo compartilhado com login individual e Firestore: quando um de vocês acrescenta, edita, apaga ou conclui uma tarefa, o outro vê a atualização automaticamente **enquanto estiver conectado**.
- Mensagens de agradecimento aparecem no mural de ambos.
- Atualizações que chegam com o aplicativo aberto exibem avisos. Com permissão e navegador compatível, pode haver aviso local enquanto o aplicativo ainda está em execução em segundo plano.
- Tarefas antigas **não são apagadas** ao entrar na casa compartilhada. O botão de importação permite adicioná-las conscientemente.

**Ainda não implementado:** mensagens automáticas pelo WhatsApp ou notificações push confiáveis com o aplicativo completamente fechado. Para isso, será necessário configurar um serviço de envio no servidor (e, para o WhatsApp, usar uma integração oficial com seus custos/regras).

## Como ativar a sincronização (uma vez só)

**Passo 1.** Abra [console.firebase.google.com](https://console.firebase.google.com/) e crie um projeto Firebase. No plano Spark, o uso pequeno costuma caber nas cotas gratuitas; confirme os limites atuais no console. Não é necessário comprar Lovable.

**Passo 2.** Em **Build > Authentication > Sign-in method**, habilite **E-mail/Senha**. Em **Settings > Authorized domains**, adicione `felilpealves.github.io` se ele ainda não estiver listado.

**Passo 3.** Em **Build > Firestore Database**, crie um banco. Na aba **Rules**, substitua as regras pelas do arquivo [`firestore.rules`](./firestore.rules), publique e confira que não está em *test mode* permitindo acesso de qualquer pessoa. As regras permitem somente membros da casa ler e alterar suas tarefas; entrada de novo membro exige aprovação do dono.

**Passo 4.** Em **Configurações do projeto > Seus apps**, registre um **app Web** (`</>`). Copie apenas os dados públicos `apiKey`, `authDomain`, `projectId` e `appId` para [`firebase-config.js`](./firebase-config.js) e publique o commit. **Não envie senha da conta, chave privada de serviço nem arquivo JSON de conta de serviço**. A configuração Web não é uma senha: a segurança é garantida pelas regras do Firestore e pelo login.

**Passo 5.** Abra o site [Nosso Cantinho](https://felilpealves.github.io/Nosso-Cantinho/), vá em **Nós > Compartilhar tarefas entre celulares**. Felipe cria a conta e a casa, copia o código e o envia em privado à Aline. Aline cria uma conta com outro e-mail, digita o código e pede acesso. Felipe aprova o e-mail dela em **Nós**. Pronto: ambos veem a **mesma lista**, inclusive pendentes e concluídas.

**Passo 6.** Se desejar trazer tarefas que já estavam cadastradas antes, no celular que tem a lista completa, toque em **Adicionar minhas tarefas locais à casa**. Isso adiciona as tarefas em vez de substituir as tarefas atuais. Faça backup antes por garantia.

## Organização do projeto

```
index.html            Interface e telas
styles.css            Layout responsivo
app.js                Gestão das tarefas, rotinas, mensagens e modo local
cloud.js              Contas, aprovação e sincronização Firestore
firebase-config.js    Configuração pública do app Web (inicialmente vazia)
firestore.rules        Regras para proteger dados e aprovação de contas
sw.js                 Cache do PWA
manifest.webmanifest  Identidade instalável do PWA
assets/               Ilustrações e ícones
 tests/               Testes automatizados
```

## Segurança e privacidade

- Ninguém entra numa casa só porque sabe o código; **o dono precisa aprovar a conta**.
- Só os membros da casa podem ler e editar seus documentos do Firestore, se as regras publicadas estiverem corretas.
- O GitHub Pages publica o código do site, mas **não guarda as senhas**. O login é processado pelo Firebase Authentication.
- Não deixe o Firestore em modo de teste nem com regras globais do tipo `allow read, write: if true`.
- O acesso à casa é limitado a duas contas; **não compartilhe o código publicamente**.
- Sem Firebase configurado o app permanece em modo local, sem sincronização, e avisa isso na aba **Nós**.

## Publicação

GitHub Pages: **Settings > Pages > Deploy from a branch > main > / (root)**. Aguarde a publicação. O aplicativo instalado recebe atualizações do PWA sem precisar desinstalar. Não limpe o armazenamento do site antes de fazer backup.

## Testes

```bash
node --check app.js
node --check cloud.js
node tests/mobile_delete_test.cjs
node tests/sync_sanity_test.cjs
```

Para testes visuais, rode um servidor HTTP no diretório e execute `python tests/smoke_test.py` em um ambiente que permita abrir um Chromium local.
