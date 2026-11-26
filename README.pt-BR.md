# pi-reopen — restaure sessões do Pi no WezTerm

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Pacote do Pi](https://pi.dev/packages/@ellieyujin/pi-reopen) · [Versões](https://github.com/AuthurX/pi-reopen/releases)

**Reabra o WezTerm. Restaure suas sessões do agente de código Pi, seus diretórios de trabalho e suas conversas com um único comando.**

![Pi session recovery preview](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.png)

Uma extensão e CLI do [Pi](https://github.com/earendil-works/pi) para **recuperação de sessões após fechar o terminal**. Ele registra as sessões do Pi abertas e as reabre como abas do [WezTerm](https://wezterm.org/), pulando sessões que já estão em execução.

## Retomar uma sessão ou restaurar um workspace?

| Objetivo | Usar |
| --- | --- |
| Continuar a sessão mais recente do diretório atual | `pi -c` embutido |
| Escolher uma conversa histórica | `pi -r` ou `/resume` embutidos |
| Reabrir as sessões do Pi registradas entre projetos após fechar o WezTerm | `pi-reopen` |
| Pré-visualizar o plano de recuperação sem abrir abas | `pi-reopen restore --dry-run` |

Isso é **restauração de sessões do workspace**, não um substituto do seletor de sessões do Pi. Ele inicia novos processos do Pi com os arquivos de sessão originais; não restaura ferramentas em execução, estado não salvo, geometria de painéis divididos nem programas de shell arbitrários. Sair do Pi de forma deliberada remove seu registro. A inicialização do WezTerm não dispara a recuperação automaticamente; execute `pi-reopen` depois de reabri-lo.

## Como usar: pense como abas do navegador

| Navegador | pi-reopen |
| --- | --- |
| Abas ainda abertas ao sair | Sessões do Pi ainda abertas quando o WezTerm fecha |
| Abas abertas voltam na próxima inicialização | `pi-reopen` restaura os registros mantidos como novas abas |
| Abas que você fechou não entram na lista de restauração | Uma aba fechada com `ctrl+w` é esquecida por padrão (ou sempre, com `/quit` dentro do Pi) |
| “Recentemente fechadas” via Ctrl+Shift+T | `/reopen recent` — as últimas 24 h, mesmo sem registro |
| Travamento → “Restaurar páginas?” | Travamento / fechar o WezTerm inteiro / desligamento do WSL → todos os registros mantidos, `pi-reopen` os recupera |

A regra a memorizar: **aberta = manter, fechada = liberar**. Sem marcadores nem comandos extras — deixar uma aba aberta é seu sinal de “quero isso de volta”, e fechá-la diz “terminei com ela”. (Padrão: fechar uma aba a tira da lista de restauração, estilo navegador; defina `PI_REOPEN_FORGET_ON_TAB_CLOSE=0` para sempre manter os registros.)

## Caso de uso e suporte de plataformas

**Feito para trabalhar entre projetos no WezTerm: você tem várias sessões do Pi abertas, fecha o terminal e quer recuperar as sessões registradas com seus diretórios de trabalho e conversas.** Reabra o WezTerm e execute `pi-reopen` para restaurar as sessões pendentes em novas abas.

| Ambiente de execução | Status de suporte | Onde as sessões reabrem |
| --- | --- | --- |
| Linux nativo | Implementado | Novas abas na instância local do WezTerm no Linux |
| macOS nativo | Implementado | Novas abas na instância local do WezTerm no Mac |
| Windows nativo | Implementado | Novas abas na instância local do WezTerm no Windows, executando o Pi nativo do Windows |
| WSL | Implementado | Novas abas no WezTerm do Windows, iniciando o Pi na distribuição WSL correspondente |
| FreeBSD e outros sistemas | Não suportado | A pré-verificação de restauração rejeita plataformas não suportadas |

**O único alvo de restauração é o WezTerm local.** Restauração no Windows Terminal, iTerm2, o terminal integrado do VS Code ou tmux não é suportada. PowerShell, Bash e zsh são shells, não aplicativos de terminal alvo; executar o comando a partir do PowerShell ainda exige o WezTerm aberto. Windows nativo e WSL são ambientes separados: uma instalação de um lado não pode restaurar sessões do outro. Migração entre máquinas não é suportada.

“Implementado” significa que existe um caminho de restauração específico da plataforma, não que todos os cenários em máquina real foram verificados. Veja [notas de plataforma](docs/PLATFORMS.md) para cobertura de validação e limitações.

## Início rápido

`@ellieyujin/pi-reopen` é o único pacote npm mantido. O comando CLI continua sendo `pi-reopen`.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

O `setup` agrupa as verificações da origem da extensão, se seu processo registrado ainda está vivo, a CLI global e o PATH, o alinhamento de versões e entradas legadas duplicadas. Ele imprime os próximos comandos específicos da plataforma, mas nunca executa `sudo`, `setx` nem altera a configuração do sistema.

Execute `/reload` em cada Pi existente para que comece a registrar. Depois de fechar e reabrir o WezTerm:

```bash
pi-reopen restore --dry-run
pi-reopen
```

Veja [instalação e migração](#instalação) antes de trocar o nome do pacote.

## Requisitos

- **Linux / macOS / Windows nativo + WezTerm local**, ou **WSL + WezTerm do Windows**
- Node ≥ 22.19, com [Pi](https://github.com/earendil-works/pi) instalado no mesmo ambiente de SO
- Abra o WezTerm antes de restaurar; esta ferramenta adiciona abas a uma instância em execução, não a um domínio SSH remoto
- Linux/macOS/WSL exigem Bash. Windows nativo exige Windows PowerShell 5.1 (incluindo CIM); instale o Git for Windows para a ferramenta Bash do Pi, e prefira um nightly recente do WezTerm
- A restauração WSL usa o usuário padrão da distribuição; execute esta ferramenta como esse usuário. Não compartilhe um único registro entre Windows nativo e WSL

A versão 1.0.0 é o primeiro lançamento estável. O CI executa testes de plataforma no Linux, macOS e Windows, com a suíte de regressão completa, verificações do tarball empacotado e o ciclo de vida real de PTY do Pi no Linux; a aceitação de fechar/reabrir do GUI no macOS/Windows ainda precisa de verificação em máquina real. Veja [notas de plataforma](docs/PLATFORMS.md).

## Uso

```bash
pi-reopen
```

```text
  ✔ pi-workspace: iniciado e confirmado (/home/ellie/work/MY/code/pi-workspace)
  ⚠ other-proj: aba criada, início do pi não confirmado a tempo (/home/ellie/work/other-proj)
2 processados
```

A saída segue a locale: chinês para `zh_*`, inglês nos demais casos. Force com `PI_REOPEN_LANG=zh|en`.

| Saída | Significado |
| --- | --- |
| `✔ iniciado e confirmado` | iniciado e confirmado |
| `⚠ aba criada, início do pi não confirmado a tempo` | aba criada, mas a confirmação do início do pi expirou |
| `N processados` | N processados |

Pontos de entrada equivalentes dentro do Pi:

- `/reopen` — restaurar os Pis registrados
- `/reopen recent` — recuperar do histórico de conversas das últimas 24 h (para janelas não registradas)
- `/reopen clear` — limpar o registro (não apaga os arquivos de conversa)
- `Ctrl+Shift+O` — restauração com um clique

`/all` ainda funciona como alias obsoleto de `/reopen` (mostra um aviso de renomeação).

## Comandos

| Comando | Descrição |
| --- | --- |
| `pi-reopen` (ou seja, `pi-reopen restore`) | Reabre os Pis que ainda estavam abertos no último fechamento; os em execução são pulados |
| `pi-reopen restore --dry-run` | Mostra apenas o plano, não abre abas |
| `pi-reopen restore --no-wait` | Pula a espera da confirmação de início de cada pi |
| `pi-reopen restore --only <padrão>` | Restaura apenas as sessões correspondentes (substring, glob `*` ou índice da lista atual; nome, caminho ou id) |
| `pi-reopen restore --interactive` | Mostra a lista atual e digite índices para selecionar sessões |
| `pi-reopen restore --limit <N>` | Abre no máximo N abas nesta execução; o restante fica para a próxima |
| `pi-reopen restore --json` | Saída legível por máquina |
| `pi-reopen list [--wide\|--json]` | Lista membros registrados e status; conteúdo longo é truncado à largura do terminal por padrão |
| `pi-reopen show <índice\|id\|prefixo> ...` | Mostra estado, caminhos, arquivo de sessão e detalhes do registro |
| `pi-reopen forget <índice\|id\|prefixo> ...` | Remove registros específicos (arquivos de conversa intactos) |
| `pi-reopen prune [--dry-run]` | Remove registros expirados/irrecuperáveis (mantém os últimos 14 dias) |
| `pi-reopen setup` | Verificações guiadas de primeira execução; imprime comandos sem alterar o sistema |
| `pi-reopen doctor` | Verificação de ambiente e registro (identidade do processo da extensão, correspondência de versão e detecção de fechamento de aba única no WSL) |
| `pi-reopen clear` | Limpa o registro e as reivindicações de início (não apaga arquivos de conversa nem registros em formato legado) |
| `pi-reopen --help` / `--version` | Uso / versão |

A coluna `#` é um **índice no snapshot da lista atual, não um ID estável**. Cada comando o resolve contra a lista mais recente na mesma ordem; após adições, remoções ou reordenação por timestamp, execute `pi-reopen list` novamente. Entrada puramente numérica é tratada primeiro como índice; IDs de sessão e prefixos únicos continuam suportados.

```bash
pi-reopen list
pi-reopen restore --only 1,3 --dry-run
pi-reopen show 2
pi-reopen forget 2
pi-reopen restore --interactive
```

Status do `list`: running (em execução) / start claimed (início reivindicado) / pending restore (restauração pendente) / expired (expirado) / open in another window (aberto em outra janela) / working directory missing (diretório de trabalho ausente) / session file missing (arquivo de sessão ausente) / não corresponde a `--only` / diferido por `--limit` / outra plataforma ou distribuição / entrada duplicada.

Códigos de saída: 0 sucesso; 1 falha no pedido de restauração ou comando desconhecido; 2 falha na pré-verificação do ambiente; 3 pedidos enviados mas não confirmados; 4 apenas pulados (reivindicado/diferido).

## Instalação

### Do npm

Use `@ellieyujin/pi-reopen` com o dist-tag estável `latest`. O pacote `pi-reopen` sem scope foi despublicado. O `pi-workspace` sem scope no npm é um projeto de outro autor.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

- `pi install` registra e carrega a extensão, mas não garante que a CLI esteja no PATH de um shell comum; `npm install -g` instala a CLI externa (o diretório bin global do npm também deve estar no PATH)
- A CLI não depende dos pacotes peer do Pi, daí `--omit=peer` para evitar instalar o host também; as duas instalações devem ser atualizadas separadamente e mantidas na mesma versão (`pi-reopen setup` / `doctor` relatam divergência)
- `pi install` declara apenas uma versão peer mínima (`>=1.5.0`), sem limite superior: qualquer Pi mais novo pode ser instalado diretamente

**O registro exige a extensão**: instalar apenas a CLI não consegue registrar sessões. Após instalar, execute `/reload` ou reinicie em cada Pi já aberto; uma instalação nova não consegue recuperar com precisão janelas anteriormente não registradas. Não carregue uma entrada de extensão local obsoleta (por exemplo um symlink antigo de `open-all.ts` ou uma cópia separada de `pi-reopen`) junto com o pacote. `pi-reopen setup` verifica as origens do pacote e entradas duplicadas prováveis no diretório de extensões pessoal; verifique-as com `pi list`, desative apenas entradas antigas e não apague arquivos de sessão ou de autenticação. `doctor`/`setup` verifica o auto-registro usando PID, hora de início do processo e boot ID; um `extension.json` antigo sozinho já não significa que a extensão está em execução agora.

### Migrando do pacote despublicado

Usuários de `@ellieyujin/pi-reopen` não precisam trocar o nome do pacote. Se você instalou o `pi-reopen` que agora está despublicado, remova-o antes de instalar o pacote mantido para evitar carga dupla e conflitos de CLI. Verifique `pi list` e remova a exata fonte antiga mostrada ali. Para uma instalação usando `@latest`:

```bash
pi remove npm:pi-reopen@latest
npm uninstall -g pi-reopen
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

Reinicie o Pi e execute `pi-reopen doctor`. Os arquivos de sessão e os registros de `~/.pi/agent/pi-reopen/` não mudam; não os apague. As versões da CLI e da extensão devem corresponder. Não combine um link de extensão local (por exemplo um `open-all.ts` antigo ou um symlink de `pi-reopen`) com o pacote npm.

### Do código-fonte

Os comandos a seguir rodam no Linux/macOS/WSL e instalam o código-fonte atualmente checkoutado:

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen setup
```

Salve a configuração do PATH no seu arquivo de inicialização do shell. Se o symlink da CLI já existir, verifique primeiro seu destino; não o sobrescreva às cegas.

No Windows nativo, a partir do repositório checkoutado no PowerShell:

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

Use `pi.cmd` em vez de `pi` se a política de execução do PowerShell bloquear o shim `.ps1` do npm; não é preciso alterar a política.

Se você precisa apenas da extensão, também pode instalar diretamente a versão Git publicada:

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## Configuração opcional

| Variável de ambiente | Finalidade |
| --- | --- |
| `PI_REOPEN_WEZTERM` | Caminho absoluto do WezTerm local (`wezterm` / `wezterm.exe`); no WSL use seu caminho do Windows, ex.: `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Caminho absoluto do executável do Pi, sem argumentos; o Windows aceita o `pi.cmd` do npm, a entrada JS do pacote ou `.exe`; aliases/funções não são suportados |
| `PI_CODING_AGENT_DIR` | Usar outro diretório de configuração/registro do Pi; a CLI e a extensão devem permanecer consistentes |
| `PI_REOPEN_SRC` | Apenas desenvolvimento: sobrescreve o diretório `src/` compartilhado; não necessário para instalações normais do pacote |
| `PI_REOPEN_LANG` | Forçar o idioma da saída: `zh` ou `en` (padrão a partir de `LC_ALL`/`LANG`) |
| `PI_REOPEN_TERMINAL` | id do adaptador de terminal; apenas `wezterm` está implementado (veja [docs/TERMINALS.md](docs/TERMINALS.md)) |
| `PI_REOPEN_MAX_AGE_DAYS` | Dias após os quais registros mortos deixam de ser restaurados (padrão 14, `0` desativa) |
| `PI_REOPEN_FORGET_ON_TAB_CLOSE` | Fechar uma aba única (o WezTerm ainda tem outras abas) é tratado como “tarefa concluída” e seu registro é excluído (padrão ativado); fechar o terminal inteiro ou uma verificação inconclusiva mantém o registro. Defina `0`/`false` para sempre manter os registros |

Nomes legados (`PI_WORKSPACE_*`) ainda são respeitados; o nome canônico `PI_REOPEN_*` prevalece quando ambos estão definidos.

Por exemplo, se o Pi foi instalado via nvm, pnpm ou um prefixo npm personalizado, defina explicitamente:

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

No Linux/macOS/WSL, o Pi é localizado a partir do PATH e do ambiente de login do Bash. O Windows nativo resolve `pi.exe` ou o `pi.cmd` do npm a partir do PATH; shims do npm são resolvidos para Node + a entrada do pacote instalado, evitando problemas de aspas do `cmd.exe` e de política de script do PowerShell. Shims do Windows não padrão exigem uma entrada JS ou `.exe` explícita. As abas restauradas recebem o PATH e o diretório do agente do chamador, não o ambiente completo nem dados de autenticação. A descoberta do WezTerm verifica o PATH específico da plataforma e locais de instalação comuns; apenas o WSL usa `where.exe` + `wslpath`. Para layouts personalizados, defina um caminho explícito. Reinicie o Pi após alterar variáveis de ambiente; `/reload` não lê o novo ambiente do shell pai.

## Como funciona

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **Registro**: em cada inicialização do Pi, `{caminho absoluto do arquivo de sessão, cwd, pid, processStart, bootId, paneId, weztermPid (WSL), platform, distro, user, schemaVersion}` é gravado em tempo real em `~/.pi/agent/pi-reopen/members/` (um arquivo por sessão, substituição atômica). Registros escritos sob `pi-workspace/` pelo 0.3.0 e versões anteriores ainda são lidos e limpos.
- **Detecção de fechamento**: as saídas por sinal do Pi também emitem um evento de limpeza `quit`, então o nome do evento sozinho não é confiável. A extensão registra SIGHUP/SIGTERM dentro do ciclo de vida da TUI; um `/quit` deliberado sem sinal ou troca de sessão remove o registro; o reload mantém o registro e limpa os listeners. Sem um sinal rastreado, ela também pergunta ao WezTerm se o painel atual ainda existe (`WEZTERM_PANE`): um painel desaparecido significa que a janela foi fechada, então o registro é mantido. Por padrão (opt-out com `PI_REOPEN_FORGET_ON_TAB_CLOSE=0`), um painel desaparecido é excluído quando o WezTerm ainda tem outros painéis (fechar uma aba = tarefa concluída, estilo navegador “abas fechadas não entram no conjunto de restauração”); sem outros painéis ou verificação inconclusiva, o registro é mantido. No WSL, `list`/`restore` reconcilia novamente a partir de um processo CLI saudável: a exclusão exige um marcador de fechamento por sinal correspondente, o mesmo PID de GUI registrado, um Pi morto, o painel original ausente e pelo menos um painel restante. Uma queda sem marcador de fechamento, um WezTerm reiniciado ou uma consulta falha mantém o registro para a recuperação. Quando um kill duro impede a limpeza, o resíduo é registrado. Em perda de energia, no máximo os registros persistidos são recuperados; as últimas mudanças não gravadas não têm garantia.
- **Início seguro**: as abas abrem em paralelo (5 por vez por padrão); cada pedido `wezterm cli spawn` é abortado com erro após 15 s sem resposta, e 3 falhas consecutivas de pedido param cedo, evitando esperas longas quando o WezTerm trava. `--limit` limita o surto.
- **Desduplicação**: antes de restaurar, a vitalidade dos processos é verificada (pid + hora de início + bootId; PIDs obsoletos após reboot não são mal interpretados), processos em execução são varridos por `--session <arquivo>` para que uma janela não registrada não abra duas vezes, e reivindicações de início (TTL de 60 s + verificação de vitalidade do detentor) reduzem pedidos duplicados. O lock global de restauração (`restore.lock`, TTL de 30 minutos + vitalidade do pid + verificação de bootId) é criado com `O_EXCL`, então restaurações concorrentes não podem iniciar um lote ambas; ele pode ser assumido após a morte do detentor do lock ou o reboot do SO.
- **Verificação**: “pedido aceito” e “pi registrado” são relatados separadamente; a janela de confirmação escala com o tamanho do lote (15 s + 2 s por sessão, com teto de 90 s).
- **Títulos e higiene**: as abas recebem o nome da sessão como título, ou o nome da pasta do cwd. Registros com mais de 14 dias ficam `expired` e não são mais restaurados automaticamente; `forget`/`prune` limpam sem tocar nos arquivos de conversa.
- **Segurança**: se a pré-verificação (identidade do processo / WezTerm em execução / Pi / adaptador de terminal / saúde do registro, mais interop do WSL quando aplicável) falhar, nada é iniciado em massa; nunca sudo automático; ENOEXEC vem com uma dica de correção.

## Desenvolvimento e testes

```bash
# a partir da raiz do repositório
npm test                    # suíte completa de regressão Linux/WSL (teste de integração pulado)
npm run test:platform       # suíte nativa Linux/macOS/Windows
npm run verify-pack         # compila o tarball, verifica o conteúdo, executa a CLI descompactada
npm run test:integration    # teste real de spawn/título do WezTerm (exige WezTerm em execução)
python3 test/pty-shutdown.py # PTY real do Pi: sinal mantém o registro, /quit remove
```

```text
extensions/index.ts      extensão do Pi (camada fina de adaptação): registra Pis vivos, oferece /reopen
src/                     núcleo compartilhado (JS ESM puro, usado pela extensão e pela CLI)
  terminals/             adaptadores de terminal (wezterm; veja docs/TERMINALS.md)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         ponto de entrada da CLI (executado diretamente com node, sem etapa de build)
test/                    testes embutidos do Node (diretórios isolados + mocks injetados, sem chamadas a terminal real)
docs/                    requisitos, status, plataformas, terminais, publicação
```

Os testes cobrem restauração central, ordem de tratamento de sinais, limpeza no reload, detecção de fechamento por painel, seleção de `/reopen recent`, caminhos de instalação não padrão do Pi, escape de shell, mesclagem de registros do diretório legado, controle de esquema, i18n e carregamento após o pacote se mover; os testes são isolados por diretórios temporários e um lançador mock. O hook de teste `PI_REOPEN_HOOKS` não deve ser definido no uso normal.

O CI executa a suíte de plataforma no Linux/macOS/Windows, a suíte completa no Linux, a verificação do tarball empacotado e o ciclo de vida real de PTY do Pi (ele instala o host do Pi). O CI não consegue abrir o GUI do WezTerm, então o teste real de spawn/título continua opt-in via `PI_REOPEN_INTEGRATION=1`.

Etapas de lançamento do mantenedor: veja o [guia de publicação](docs/PUBLISHING.md) e o [CHANGELOG](CHANGELOG.md).

## Feedback e divulgação

Se isso resolver seu fluxo de reinício de terminal, compartilhe o [repositório](https://github.com/AuthurX/pi-reopen) com outros usuários de Pi / WezTerm. [Reporte problemas de recuperação](https://github.com/AuthurX/pi-reopen/issues) com seu SO, as versões de Pi/WezTerm e a saída **anonimizada** de `pi-reopen doctor`. Nunca faça upload de credenciais ou arquivos de conversa privados. Veja os [rascunhos de divulgação e plano de medição](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md).

## Contribuidores

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## Licença

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
