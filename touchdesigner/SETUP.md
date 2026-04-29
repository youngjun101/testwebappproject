# TouchDesigner setup

1. Open TouchDesigner and create or open the `.toe` you want to control.
2. Drop a **Web Socket DAT** into the network.
3. In the Web Socket DAT parameters:
   - **Network Address:** `wss://YOUR-RELAY.onrender.com?token=YOUR_TD_SERVICE_KEY`
     - Use the EXACT same value you set as `TD_SERVICE_KEY` in the backend env vars.
   - **Active:** On
   - **Auto-Reconnect:** On (recommended)
4. The Web Socket DAT auto-creates a callbacks DAT next to it. Open that callbacks DAT and replace its contents with `websocket_callbacks.py` from this folder.
5. Edit `ACTION_HANDLERS` in that script so each action targets the real operators in your project (the example uses paths like `/project1/master_color` — change to match your network).
6. Save the project as `project.toe`.

## Test plan

- With backend running and TD connected, click a button on the web UI. The matching handler should fire in TD.
- Disconnect the network on TD; the web UI's status pill should flip to "TouchDesigner is not connected" if you click a button.
- Reconnect TD; web UI should resume working without a refresh.

## Sending state from TD back to the browser

From any DAT or script in TD:

```python
import json
op('websocket1').sendText(json.dumps({ 'type': 'status', 'fps': me.time.rate }))
```

All connected web clients will receive it as a WebSocket message.
