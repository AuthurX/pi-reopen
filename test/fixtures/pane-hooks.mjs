// 测试钩子：模拟 wezterm cli list 的 pane 探测；PI_WORKSPACE_PANE_ALIVE=1 表示 pane 仍存在。
export default () => ({
	noWait: true,
	paneExists: () => process.env.PI_WORKSPACE_PANE_ALIVE === "1",
});
