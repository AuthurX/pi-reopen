# pi-reopen — WezTerm를 다시 열어 Pi 세션 복원

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (BR)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Pi 패키지](https://pi.dev/packages/@ellieyujin/pi-reopen) · [릴리스](https://github.com/AuthurX/pi-reopen/releases)

**터미널을 닫은 뒤의 Pi 코딩 에이전트 세션, 작업 디렉터리, 대화를 하나의 명령으로 복원합니다.**

![Pi session recovery preview](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/preview.png)

[Pi](https://github.com/earendil-works/pi) 확장 + CLI.**터미널을 닫은 후의 세션 복원**용입니다. 열려 있는 Pi 세션을 기록하고, [WezTerm](https://wezterm.org/) 탭으로 다시 열며, 이미 실행 중인 세션은 건너뜁니다.

## 세션 하나를 되돌릴 것인가, 워크스페이스 전체를 복원할 것인가?

| 목표 | 사용 |
| --- | --- |
| 현재 디렉터리의 최신 세션을 이어가기 | 내장 `pi -c` |
| 과거 대화 중 하나를 고르기 | 내장 `pi -r` 또는 `/resume` |
| WezTerm 종료 후 프로젝트에 걸친 기록된 Pi 세션 다시 열기 | `pi-reopen` |
| 탭을 열지 않고 복원 계획 미리보기 | `pi-reopen restore --dry-run` |

이것은 워크스페이스 **세션 복원** 도구이며, Pi의 세션 피커 대체품이 아닙니다. 원래 세션 파일로 새 Pi 프로세스를 시작할 뿐, 실행 중인 도구, 저장되지 않은 상태, 분할 페인 기하, 임의의 셸 프로그램은 복원하지 않습니다. Pi를 의도적으로 종료하면 등록이 삭제됩니다. WezTerm 시작 시 자동 복원은 이루어지지 않으며, 다시 연 뒤 `pi-reopen`을 실행하세요.

## 사용법: 브라우저 탭으로 생각하면 됩니다

| 브라우저 | pi-reopen |
| --- | --- |
| 종료했을 때 열려 있던 탭 | WezTerm을 닫을 때 아직 열려 있던 Pi 세션 |
| 다음 시작 시 열려 있던 탭이 돌아옴 | `pi-reopen`이 유지된 기록을 새 탭으로 복원 |
| 직접 닫은 탭은 복원 목록에 없음 | `ctrl+w`로 닫은 탭은 기본적으로 잊힘(Pi 안에서 `/quit`하면 항상 잊힘) |
| Ctrl+Shift+T "최근 닫은 탭" | `/reopen recent` — 최근 24시간, 기록이 없어도 가능 |
| 충돌 → "페이지를 복원할까요?" | 충돌 / WezTerm 전체 종료 / WSL 종료 → 모든 기록 유지, `pi-reopen`으로 되찾음 |

기억할 규칙: **열려 있음 = 유지, 닫음 = 방출**. 마커나 추가 명령이 필요 없습니다 — 탭을 열어 두는 것이 "이건 다시 줘" 신호이고, 닫는 것이 "이제 끝"이라는 뜻입니다. (기본값: 탭을 닫으면 복원 목록에서 제거, 브라우저식 동작. `PI_REOPEN_FORGET_ON_TAB_CLOSE=0`으로 항상 기록을 유지할 수 있습니다.)

## 사용 사례와 플랫폼 지원

**WezTerm에서 여러 프로젝트를 오가며 일하는 경우에 적합합니다: 여러 Pi 세션을 열어 두고 터미널을 닫은 뒤, 기록된 세션의 작업 디렉터리와 대화를 되찾고 싶을 때.** WezTerm를 다시 열고 `pi-reopen`을 실행하면 대기 중인 세션을 새 탭으로 복원합니다.

| 실행 환경 | 지원 상태 | 세션 복원 위치 |
| --- | --- | --- |
| 네이티브 Linux | 구현됨 | 로컬 Linux WezTerm 인스턴스의 새 탭 |
| 네이티브 macOS | 구현됨 | 로컬 Mac WezTerm 인스턴스의 새 탭 |
| 네이티브 Windows | 구현됨 | 로컬 Windows WezTerm 인스턴스의 새 탭(네이티브 Windows Pi 실행) |
| WSL | 구현됨 | Windows WezTerm의 새 탭, 해당하는 WSL 배포판에서 Pi 시작 |
| FreeBSD 등 다른 OS | 미지원 | 복원 사전 점검이 미지원 플랫폼을 거부 |

**복원 대상은 로컬 WezTerm뿐입니다.** Windows Terminal, iTerm2, VS Code 통합 터미널, tmux로의 복원은 지원하지 않습니다. PowerShell, Bash, zsh는 셸이지 복원 대상 터미널 애플리케이션이 아닙니다. PowerShell에서 명령을 실행하더라도 WezTerm이 열려 있어야 합니다. 네이티브 Windows와 WSL은 별개의 환경으로, 한쪽의 설치로는 다른 쪽의 세션을 복원할 수 없습니다. 기계 간 마이그레이션도 지원하지 않습니다.

"구현됨"은 플랫폼별 복원 경로가 존재한다는 뜻이지, 모든 실기 시나리오가 검증되었다는 뜻은 아닙니다. 검증 범위와 한계는 [플랫폼 노트](docs/PLATFORMS.md)를 참조하세요.

## 빠른 시작

유일하게 유지보수되는 npm 패키지는 `@ellieyujin/pi-reopen`입니다. CLI 명령은 여전히 `pi-reopen`입니다.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

`setup`은 확장 소스, 기록 프로세스의 생존 여부, 전역 CLI와 PATH, 버전 일치, 중복된 레거시 항목을 한 번에 점검합니다. 플랫폼별 다음 명령을 표시하지만 `sudo`나 `setx`를 실행하지 않고 시스템 설정을 변경하지 않습니다.

기존 각 Pi에서 `/reload`를 실행해 기록을 시작하세요. WezTerm를 닫고 다시 연 뒤:

```bash
pi-reopen restore --dry-run
pi-reopen
```

패키지 이름을 바꾸기 전에 [설치와 마이그레이션](#설치)을 읽어 주세요.

## 요구 사항

- **Linux / macOS / 네이티브 Windows + 로컬 WezTerm**, 또는 **WSL + Windows WezTerm**
- Node ≥ 22.19, 같은 OS 환경에 [Pi](https://github.com/earendil-works/pi) 설치
- 복원 전 WezTerm을 열고 있어야 함; 이 도구는 실행 중인 인스턴스에 탭을 추가할 뿐 원격 SSH 도메인이 아닙니다
- Linux/macOS/WSL에는 Bash 필요. 네이티브 Windows에는 Windows PowerShell 5.1(CIM 포함) 필요; Pi의 Bash 도구를 위해 Git for Windows 설치 권장, 최신 WezTerm nightly 권장
- WSL 복원은 배포판 기본 사용자를 사용; 해당 사용자로 이 도구를 실행하세요. 네이티브 Windows와 WSL이 하나의 레지스트리를 공유하지 않도록 하세요

1.0.0이 첫 안정 릴리스입니다. CI는 Linux, macOS, Windows에서 플랫폼 테스트를 실행하고, Linux에서 전체 회귀 스위트, 패키지 tarball 검사, 실제 Pi PTY 라이프사이클을 실행합니다; macOS/Windows GUI 닫기/재개수용은 실기 검증이 필요합니다. [플랫폼 노트](docs/PLATFORMS.md) 참조.

## 사용법

```bash
pi-reopen
```

```text
  ✔ pi-workspace: 시작 및 확인됨 (/home/ellie/work/MY/code/pi-workspace)
  ⚠ other-proj: 탭 생성됨, pi 시작 확인 시간 초과 (/home/ellie/work/other-proj)
2건 처리
```

출력은 로케일을 따릅니다: `zh_*`는 중국어, 그 외는 영어. `PI_REOPEN_LANG=zh|en`으로 강제할 수 있습니다.

| 출력 | 의미 |
| --- | --- |
| `✔ 시작 및 확인됨` | 시작되어 확인됨 |
| `⚠ 탭 생성됨, pi 시작 확인 시간 초과` | 탭은 생성되었으나 pi 시작 확인이 타임아웃 |
| `N건 처리` | N건 처리 |

Pi 안의 동등한 진입점:

- `/reopen` — 등록된 Pi 복원
- `/reopen recent` — 최근 24시간 대화 기록에서 골라옴(미등록 윈도우용)
- `/reopen clear` — 레지스트리 비우기(대화 파일은 삭제하지 않음)
- `Ctrl+Shift+O` — 원클릭 복원

`/all`은 여전히 `/reopen`의 비추천 별칭으로 동작합니다(이름 변경 안내 표시).

## 명령

| 명령 | 설명 |
| --- | --- |
| `pi-reopen`(= `pi-reopen restore`) | 마지막 종료 시 열려 있던 Pi를 다시 열기; 실행 중인 것은 건너뜀 |
| `pi-reopen restore --dry-run` | 계획만 표시, 탭은 열지 않음 |
| `pi-reopen restore --no-wait` | 각 pi의 시작 확인 대기 건너뜀 |
| `pi-reopen restore --only <패턴>` | 일치하는 세션만 복원(부분 문자열, `*` 글로브 또는 현재 목록 인덱스; 이름, 경로, id) |
| `pi-reopen restore --interactive` | 현재 목록을 보여 주고 인덱스로 세션 선택 |
| `pi-reopen restore --limit <N>` | 이번 실행에서 최대 N개 탭만 열기; 나머지는 다음 번으로 보류 |
| `pi-reopen restore --json` | 기계가 읽을 수 있는 출력 |
| `pi-reopen list [--wide\|--json]` | 등록된 멤버와 상태 목록; 긴 내용은 기본적으로 터미널 너비로 잘림 |
| `pi-reopen show <인덱스\|id\|접두사> ...` | 상태, 경로, 세션 파일, 등록 상세 표시 |
| `pi-reopen forget <인덱스\|id\|접두사> ...` | 특정 기록 삭제(대화 파일은 그대로) |
| `pi-reopen prune [--dry-run]` | 만료/복원 불가 기록 삭제(최근 14일 유지) |
| `pi-reopen setup` | 첫 실행 가이드 점검; 명령만 표시하고 시스템은 변경하지 않음 |
| `pi-reopen doctor` | 환경과 레지스트리 점검(확장 프로세스 동일성, 버전 일치, WSL 단일 탭 닫힘 감지) |
| `pi-reopen clear` | 레지스트리와 시작 점유 비우기(대화 파일이나 레거시 형식 기록은 삭제하지 않음) |
| `pi-reopen --help` / `--version` | 사용법 / 버전 |

`#` 열은 **현재 목록 스냅샷 안의 인덱스이지 안정적인 ID가 아닙니다**. 각 명령은 최신 목록의 같은 순서로 해석합니다; 추가, 삭제, 타임스탬프 순서 변화 후에는 다시 `pi-reopen list`를 실행하세요. 순수 숫자 입력은 먼저 인덱스로 취급됩니다; 세션 ID와 고유 접두사는 여전히 지원합니다.

```bash
pi-reopen list
pi-reopen restore --only 1,3 --dry-run
pi-reopen show 2
pi-reopen forget 2
pi-reopen restore --interactive
```

`list` 상태: 실행 중 / 시작 점유 중 / 복원 대기 / 만료 / 다른 윈도우에서 열림 / 작업 디렉터리 없음 / 세션 파일 없음 / `--only`에 일치하지 않음 / `--limit`으로 보류 / 다른 플랫폼 또는 배포판 / 중복 항목.

종료 코드: 0 성공; 1 복원 요청 실패 또는 알려지지 않은 명령; 2 환경 사전 점검 실패; 3 요청은 보냈지만 확인되지 않음; 4 건너뜀만 있음(점유됨/보류됨).

## 설치

### npm에서

`@ellieyujin/pi-reopen`과 안정 `latest` dist-tag를 사용하세요. 스코프 없는 `pi-reopen` 패키지는 공개가 중단되었습니다. 스코프 없는 `pi-workspace`(npm)는 다른 저자의 프로젝트입니다.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen setup
```

- `pi install`은 확장을 등록하고 로드하지만 CLI가 일반 셸의 PATH에 있는지 보장하지는 않습니다; `npm install -g`가 외부 CLI를 설치합니다(npm 전역 bin 디렉터리도 PATH에 있어야 함)
- CLI는 Pi의 peer 패키지에 의존하지 않으므로 호스트까지 설치하지 않기 위해 `--omit=peer`; 두 설치물은 각각 업데이트하여 같은 버전을 유지해야 합니다(`pi-reopen setup` / `doctor`가 어긋남을 보고)
- `pi install`은 최소 peer 버전(`>=1.5.0`)만 선언하고 상한이 없음: 더 새로운 Pi도 바로 설치 가능

**등록에는 확장이 필요합니다**: CLI만 설치해서는 세션을 기록할 수 없습니다. 설치 후 이미 열린 각 Pi에서 `/reload` 또는 재시작을 실행하세요; 새 설치는 이전에 등록되지 않았던 윈도우를 정확히 복구할 수 없습니다. 구식 로컬 확장 항목(예: 오래된 `open-all.ts` 심볼릭 링크나 별개의 `pi-reopen` 사본)을 패키지와 동시에 로드하지 마세요. `pi-reopen setup`은 패키지 소스와 개인 확장 디렉터리의 의심스러운 중복 항목을 점검합니다; `pi list`로 확인하고 구식 항목만 비활성화하며, 세션이나 인증 파일을 삭제하지 마세요. `doctor`/`setup`은 PID, 프로세스 시작 시각, boot ID로 자기 기록을 검증합니다; 오래된 `extension.json` 하나만으로는 확장이 현재 실행 중이라는 보장이 되지 않습니다.

### 공개 중단된 패키지에서 마이그레이션

`@ellieyujin/pi-reopen` 사용자는 패키지 이름을 바꿀 필요가 없습니다. 이제 공개가 중단된 `pi-reopen`을 설치했다면, 유지보수 중인 패키지를 설치하기 전에 제거해 중복 로딩과 CLI 충돌을 피하세요. `pi list`를 확인하고 거기 표시되는 정확한 기존 소스를 제거하세요. `@latest`로 설치한 경우:

```bash
pi remove npm:pi-reopen@latest
npm uninstall -g pi-reopen
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
```

Pi를 재시작한 뒤 `pi-reopen doctor`를 실행하세요. 세션 파일과 `~/.pi/agent/pi-reopen/` 등록은 그대로입니다; 삭제하지 마세요. CLI와 확장 버전은 일치해야 합니다. 로컬 확장 링크(예: 오래된 `open-all.ts`나 `pi-reopen` 심볼릭 링크)를 npm 패키지와 함께 사용하지 마세요.

### 소스에서

아래 명령은 Linux/macOS/WSL에서 실행하며 현재 체크아웃된 소스를 설치합니다:

```bash
git clone https://github.com/AuthurX/pi-reopen.git
cd pi-reopen
pi install .
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/bin/pi-reopen.js" "$HOME/.local/bin/pi-reopen"
export PATH="$HOME/.local/bin:$PATH"
pi-reopen setup
```

앞으로 쓰도록 PATH 설정을 셸 시작 파일에 저장하세요. CLI 심볼릭 링크가 이미 존재하면 대상을 먼저 확인하고 무작정 덮어쓰지 마세요.

네이티브 Windows에서는 체크아웃된 저장소에서 PowerShell로:

```powershell
pi install .
node .\bin\pi-reopen.js doctor
node .\bin\pi-reopen.js
```

PowerShell 실행 정책이 npm의 `.ps1` shim을 차단하면 `pi` 대신 `pi.cmd`를 사용하세요; 정책 변경은 필요하지 않습니다.

확장만 필요하면 push된 Git 버전을 직접 설치할 수도 있습니다:

```bash
pi install git:github.com/AuthurX/pi-reopen
```

## 선택 설정

| 환경 변수 | 목적 |
| --- | --- |
| `PI_REOPEN_WEZTERM` | 로컬 WezTerm 절대 경로(`wezterm` / `wezterm.exe`); WSL에서는 Windows 경로를 사용, 예: `/mnt/c/Program Files/WezTerm/wezterm.exe` |
| `PI_REOPEN_PI_BIN` | Pi 실행 파일 절대 경로, 인자 없이; Windows는 npm `pi.cmd`, 패키지의 JS 엔트리, 또는 `.exe`를 받음; 별칭/함수는 미지원 |
| `PI_CODING_AGENT_DIR` | 다른 Pi 설정/레지스트리 디렉터리 사용; CLI와 확장이 일치해야 함 |
| `PI_REOPEN_SRC` | 개발 전용: 공유 `src/` 디렉터리 덮어쓰기; 일반 패키지 설치에는 불필요 |
| `PI_REOPEN_LANG` | 출력 언어 강제: `zh` 또는 `en`(기본 `LC_ALL`/`LANG` 기준) |
| `PI_REOPEN_TERMINAL` | 터미널 어댑터 id; `wezterm`만 구현됨([docs/TERMINALS.md](docs/TERMINALS.md) 참조) |
| `PI_REOPEN_MAX_AGE_DAYS` | 며칠 지난 죽은 기록부터 자동 복원하지 않는가(기본 14, `0`이면 비활성) |
| `PI_REOPEN_FORGET_ON_TAB_CLOSE` | 단일 탭 닫기(WezTerm에 다른 탭이 있는 경우)를 "작업 완료"로 취급해 기록 삭제(기본 켜짐); 터미널 전체 종료나 판단 불가는 기록 유지. `0`/`false`로 항상 기록 유지 |

레거시 이름(`PI_WORKSPACE_*`)도 여전히 존중됩니다; 둘 다 설정되면 정식 `PI_REOPEN_*` 이름이 우선합니다.

예를 들어 Pi를 nvm, pnpm, 또는 커스텀 npm prefix로 설치했다면 명시적으로 설정하세요:

```bash
export PI_REOPEN_PI_BIN="$(type -P pi)"
export PI_REOPEN_WEZTERM="/mnt/c/Program Files/WezTerm/wezterm.exe"
pi-reopen doctor
```

Linux/macOS/WSL에서는 Pi를 PATH와 Bash 로그인 환경에서 찾습니다. 네이티브 Windows는 PATH에서 `pi.exe` 또는 npm의 `pi.cmd`를 해석합니다; npm shim은 Node + 설치된 패키지 엔트리로 해석되어 `cmd.exe` 인용부호와 PowerShell 스크립트 정책 문제를 피합니다. 비표준 Windows shim에는 명시적 JS 엔트리 또는 `.exe`가 필요합니다. 복원된 탭은 호출자의 PATH와 에이전트 디렉터리를 받고, 전체 환경이나 인증 데이터는 받지 않습니다. WezTerm 발견은 플랫폼별 PATH와 일반적인 설치 위치를 확인하며, `where.exe` + `wslpath`를 쓰는 것은 WSL뿐입니다. 커스텀 레이아웃이면 명시적 경로를 설정하세요. 환경 변수를 바꾼 후에는 Pi를 재시작하세요; `/reload`는 부모 셸의 새 환경을 읽지 않습니다.

## 동작 방식

![How it works](https://raw.githubusercontent.com/AuthurX/pi-reopen/main/assets/how-it-works.png)

- **등록**: Pi가 시작될 때마다 `{세션 파일 절대 경로, cwd, pid, processStart, bootId, paneId, weztermPid (WSL), platform, distro, user, schemaVersion}`이 실시간으로 `~/.pi/agent/pi-reopen/members/`에 기록됩니다(세션당 파일 1개, 원자적 교체). 0.3.0 이전이 `pi-workspace/` 아래에 쓴 기록도 여전히 읽고 정리합니다.
- **닫힘 감지**: Pi의 시그널 종료도 `quit` 정리 이벤트를 발사하므로 이벤트 이름만으로는 신뢰할 수 없습니다. 확장은 TUI 라이프사이클 내에서 SIGHUP/SIGTERM을 기록합니다; 시그널 없는 의도적 `/quit`이나 세션 전환은 기록을 삭제하고; 재로드는 기록을 유지하고 리스너를 정리합니다. 추적된 시그널이 없으면 WezTerm에게 현재 페인(`WEZTERM_PANE`)이 아직 있는지 물어봅니다: 페인이 사라졌으면 윈도우가 닫혔다는 뜻으로 기록은 유지됩니다. 기본적으로(`PI_REOPEN_FORGET_ON_TAB_CLOSE=0`으로 옵트아웃) WezTerm에 다른 페인이 있으면 사라진 페인은 대신 삭제됩니다(탭 하나 닫기 = 작업 완료, 브라우저식 "닫은 탭은 복원 세트에 포함 안 됨"); 다른 페인이 없거나 판단 불가면 기록 유지. WSL에서는 `list`/`restore`가 건강한 CLI 프로세스에서 다시 조정합니다: 삭제에는 일치하는 시그널 닫힘 마커, 같은 등록된 GUI PID, 죽은 Pi, 원래 페인 부재, 나머지 페인 1개 이상이 필요하고; 닫힘 마커 없는 충돌, 재시작된 WezTerm, 조회 실패면 복원을 위해 기록을 유지합니다. 강제 kill로 정리가 막히면 잔재가 기록됩니다. 정전 시에는 영속화된 기록이 복원되는 게 최대이며, 최신 미플러시된 변경은 보장되지 않습니다.
- **안전한 시작**: 탭은 병렬로 열립니다(기본 동시 5개); 각 `wezterm cli spawn` 요청은 15초간 응답 없으면 에러로 중단되고, 3연속 요청 실패로 일찍 중단되어 WezTerm이 막혀 있을 때 길게 기다리는 것을 피합니다. `--limit`이 버스트를 제한합니다.
- **중복 제거**: 복원 전 프로세스 생존을 확인하고(pid + 시작 시각 + bootId; 재부팅 후의 오래된 PID는 오인되지 않음), 실행 중 프로세스를 `--session <파일>`로 스캔해 미등록 윈도우가 두 번 열리지 않게 하고, 시작 점유(60초 TTL + 보유자 생존 확인)로 중복 요청을 줄입니다. 전역 복원 락(`restore.lock`, 30분 TTL + pid 생존 + bootId 확인)은 `O_EXCL`로 생성되어 병렬 복원이 동시에 배치 시작할 수 없고; 락 보유자가 죽거나 OS가 재부팅하면 인수할 수 있습니다.
- **검증**: "요청 수락"과 "pi 등록됨"은 따로 보고됩니다; 확인 창은 배치 크기에 따라 커집니다(15s + 세션당 2s, 상한 90s).
- **제목과 위생**: 탭은 세션 이름, 없으면 cwd 폴더 이름으로 제목이 붙습니다. 14일보다 오래된 기록은 `expired`로 자동 복원되지 않으며; `forget`/`prune`은 대화 파일에 손대지 않고 정리합니다.
- **안전**: 사전 점검(프로세스 동일성 / 실행 중 WezTerm / Pi / 터미널 어댑터 / 레지스트리 건전성, 해당 시 WSL 상호운용 포함)에 실패하면 아무것도 일괄 시작되지 않습니다; 자동 sudo 절대 금지; ENOEXEC에는 수정 힌트가 붙습니다.

## 개발과 테스트

```bash
# 저장소 루트에서
npm test                    # Linux/WSL 전체 회귀 스위트(통합 테스트는 스킵)
npm run test:platform       # 네이티브 Linux/macOS/Windows 스위트
npm run verify-pack         # tarball 빌드, 내용물 확인, 압축 풀린 CLI 실행
npm run test:integration    # 실제 WezTerm spawn/제목 테스트(실행 중 WezTerm 필요)
python3 test/pty-shutdown.py # 실제 Pi PTY: 시그널은 기록 유지, /quit는 삭제
```

```text
extensions/index.ts      Pi 확장(얇은 어댑터 계층): 살아 있는 Pi 등록, /reopen 제공
src/                     공유 코어(순수 JS ESM, 확장과 CLI가 공동 사용)
  terminals/             터미널 어댑터(wezterm; docs/TERMINALS.md 참조)
  platform/windows/paths/liveness/members/claims/plan/preflight/discover/
  launch/spawn/verify/restore/cli/prune/health/inuse/pane/sessions/i18n/version
bin/pi-reopen.js         CLI 엔트리 포인트(node로 직접 실행, 빌드 단계 없음)
test/                    Node 내장 테스트(격리 디렉터리 + 주입 mock, 실제 터미널 호출 없음)
docs/                    요구 사항, 상태, 플랫폼, 터미널, 배포
```

테스트는 핵심 복원, 시그널 처리 순서, 재로드 정리, 페인 기반 닫힘 감지, `/reopen recent` 고르기, 비표준 Pi 설치 경로, 셸 이스케이프, 레거시 디렉터리 기록 병합, 스키마 게이팅, i18n, 패키지 이동 후 로딩을 덮습니다; 테스트는 임시 디렉터리와 mock 런처로 격리됩니다. 테스트 훅 `PI_REOPEN_HOOKS`는 일반 사용 중에 설정하지 마세요.

CI는 Linux/macOS/Windows에서 플랫폼 스위트, Linux에서 전체 스위트, 패키지 tarball 검사, 실제 Pi PTY 라이프사이클(Pi 호스트를 설치함)을 실행합니다. CI는 WezTerm GUI를 열 수 없어 실제 spawn/제목 테스트는 `PI_REOPEN_INTEGRATION=1` 옵트인 그대로입니다.

메인터이너 릴리스 단계: [배포 가이드](docs/PUBLISHING.md)와 [CHANGELOG](CHANGELOG.md) 참조.

## 피드백과 공유

이 도구가 터미널 재시작 워크플로우를 해결했다면, 다른 Pi / WezTerm 사용자에게 [저장소](https://github.com/AuthurX/pi-reopen)를 공유하세요. [복원 문제 보고](https://github.com/AuthurX/pi-reopen/issues)할 때는 OS, Pi/WezTerm 버전, **마스킹된** `pi-reopen doctor` 출력을 함께 주세요. 자격 증명이나 개인 대화 파일을 절대 업로드하지 마세요. [프로모션 초안과 측정 계획](https://github.com/AuthurX/pi-reopen/blob/main/docs/promotion/README.md) 참조.

## 기여자

- [AuthurX](https://github.com/AuthurX)
- [abelxiaoxing](https://github.com/abelxiaoxing)

## 라이선스

[MIT](LICENSE), Copyright (c) 2026 ellieyujin
