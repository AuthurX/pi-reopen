# Draft: Reopen your Pi sessions after closing WezTerm

Maintainer note: publish only after reviewing the release checklist. This draft uses the currently published scoped package; switch to the shorter name only after verifying its npm release.

---

I maintain **pi-reopen**, a Pi extension + CLI for a specific workflow: you have Pi sessions open across projects, close WezTerm, then want those conversations back without hunting through history.

The extension records open sessions. After reopening WezTerm, `pi-reopen` starts them in new tabs with their original working directories and conversation files. Already-running sessions are skipped.

```bash
pi install npm:@ellieyujin/pi-reopen@latest
npm install -g @ellieyujin/pi-reopen@latest --omit=peer
pi-reopen doctor
```

Run `/reload` in existing Pi instances to register them. After closing and reopening WezTerm:

```bash
pi-reopen restore --dry-run
pi-reopen
```

For one recent conversation, built-in `pi -c` is simpler. This tool is for restoring a group of recorded sessions; it does not preserve split-pane geometry, running tools, or unsaved process state. It does not automatically run when WezTerm starts.

Supports local Linux/macOS/Windows WezTerm and WSL + Windows WezTerm. WSL has real-machine acceptance coverage; macOS/Windows GUI close/reopen validation is still needed despite cross-platform CI.

Source: https://github.com/AuthurX/pi-reopen

I'd especially welcome reports about terminal restart behavior and package migration. Please redact private paths and conversation content from diagnostic output.
