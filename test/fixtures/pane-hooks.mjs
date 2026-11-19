// 测试钩子：模拟 wezterm cli list 的 pane 探测；
// PI_WORKSPACE_PANE_ALIVE=1 表示本 pane 仍存在，PI_WORKSPACE_OTHER_PANES=1 表示还有其他 pane。
export default () => ({
	noWait: true,
	paneExists: () => process.env.PI_WORKSPACE_PANE_ALIVE === "1",
	otherPanesExists: () => process.env.PI_WORKSPACE_OTHER_PANES === "1",
	forgetDelayMs: 1,
});
