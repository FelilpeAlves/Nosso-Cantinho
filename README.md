# Nosso Cantinho ♡

Aplicativo web instalável (PWA) para Felipe e Aline organizarem tarefas de casa. Design pêssego/terracota com ilustrações dos cômodos, carinho e navegação mobile-first.

## Recursos disponíveis

- Adicionar, editar, excluir, concluir e desfazer tarefas.
- Atribuir tarefas a Felipe ou Aline, escolher cômodo e periodicidade (única, diária, semanal).
- Filtros de tarefas e destaque da última conclusão.
- Mural de agradecimentos e compartilhamento **manual** de uma mensagem por WhatsApp.
- Exportação e importação de backups JSON.
- Salvamento local no navegador (`localStorage`) e uso offline após a primeira visita online, por PWA/service worker.
- Layout adaptado a telas pequenas, teclado e preferência de movimento reduzido.

**IMPORTANTE — versão local:** cada aparelho guarda sua própria lista. Ainda **não existe sincronização em tempo real entre os celulares**, nem push automático no celular do outro. Para isso será necessário configurar um serviço com autenticação, banco de dados e notificações. Não coloque dados sensíveis reais no app até essa etapa ser revisada.

## Publicar no GitHub Pages

1. Abra **Settings → Pages** no repositório `FelilpeAlves/Nosso-Cantinho`.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)` e clique em **Save**.
4. Aguarde a publicação. O endereço esperado será `https://felilpealves.github.io/Nosso-Cantinho/` (confirme pelo link exibido no GitHub Pages).
5. Android/Chrome: menu `⋮` → **Instalar app** ou **Adicionar à tela inicial**. iPhone/Safari: Compartilhar → **Adicionar à Tela de Início**.

> Atenção: abrir o HTML dentro do visualizador do chat pode bloquear scripts ou armazenamento. Teste pelo link real do Pages.

## Como executar localmente

Na pasta do projeto, use:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador. Não precisa de NPM, conta paga ou configuração de servidor.

## Estrutura

```text
index.html                Interface e acessibilidade
styles.css                Visual e responsividade
app.js                    Tarefas, rotina, carinho e backup
manifest.webmanifest      Instalação como app
sw.js                     Cache offline
assets/                   Ícones e ilustrações SVG/PNG
README.md                 Manual de uso e deploy
```

## Dados e privacidade

- As informações são armazenadas com a chave `nosso-cantinho-v4` no `localStorage` do dispositivo.
- Backups são arquivos `.json` gerados no próprio aparelho. Evite compartilhar esse arquivo se contiver dados pessoais.
- O app não coleta telemetria, não envia tarefas a serviços externos e não exige login.
- Ao apagar os dados do navegador, os dados do app podem ser perdidos, a menos que haja backup.
- O botão WhatsApp abre uma mensagem preparada para você escolher o destinatário e enviar. **Não envia sozinho**.

## Evoluções planejadas

- Login separado por pessoa e banco compartilhado (Supabase/Firebase, com regras de acesso).
- Sincronização das tarefas e dos agradecimentos entre os aparelhos.
- Notificações push autorizadas por cada usuário, usando backend e push service.
- Testes de segurança e de permissões antes de liberar recursos compartilhados.
