# Gamification 遊戲化模組

此資料夾為階段 5 開發範圍。

## 責任範圍
- **跳出式轉盤**：隨機獎品（點數、購物金、折扣券）
- **刮刮樂**：canvas 實作 + 獎品權重
- **每日簽到**：連續簽到加成
- 獎勵發放至 Users.points 與 Users.storeCredit
- 所有獎品權重、發放上限都必須可在後台 CRUD

## 相關 Payload Collections（階段 5 會建立）
- `game-configs`：各遊戲設定（啟用、顯示位置、冷卻時間）
- `game-prizes`：獎品池、權重、庫存
- `game-plays`：使用者每次遊玩紀錄
- `check-ins`：每日簽到紀錄
