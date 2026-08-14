## AUTOPILOT（CKMU-AUTOPILOT-001）
- 使用者說「下一步」= 執行 /next 程序；說「停」= 立即中止、狀態⏸
- 進度真相源：docs/workorders/PIPELINE-STATE.md；工作單同目錄
- 部署授權僅限 pre.chickimmiu.com（含 PM2、pre 之 nginx，先 nginx -t）
- 觸及 www / Shopline / DNS / 正式金流 / 任何付費 = 停止並報告
- 驗證不過不得推進狀態；重試上限 1 次；不得帶紅燈前進
- 步驟 11 前，既有網頁 cart/checkout 檔案僅 BP-002 外包可動
