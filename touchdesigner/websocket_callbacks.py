# Paste this into the websocket_callbacks DAT attached to your Web Socket DAT.
# It parses incoming JSON commands from the web clients and routes them to ops.
# Customize the ACTION_HANDLERS map with the operators in YOUR network.

import json

def onConnect(dat):
    print('[ws] connected to relay')
    return

def onDisconnect(dat):
    print('[ws] disconnected from relay')
    return

def onReceiveText(dat, rowIndex, message):
    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        print('[ws] warning: malformed JSON:', message[:120])
        return

    action = data.get('action')
    handler = ACTION_HANDLERS.get(action)
    if not handler:
        print(f'[ws] unknown action: {action!r}')
        return

    try:
        handler(data)
    except Exception as e:
        print(f'[ws] error in handler {action!r}: {e}')


# ---------- Action handlers ----------
# Replace the operator paths below with the real ops in your network.

def _trigger_effect(data):
    effect = data.get('effect', 'pulse')
    # Example: pulse a CHOP based on effect name
    op_path = f'/project1/effects/{effect}_pulse'
    target = op(op_path)
    if target is not None:
        target.par.pulse.pulse()
    else:
        print(f'[ws] no operator at {op_path}')

def _load_scene(data):
    scene = int(data.get('scene', 1))
    sw = op('/project1/scene_switch')
    if sw is not None:
        sw.par.index = scene - 1

def _set_color(data):
    target = op('/project1/master_color')
    if target is None: return
    target.par.colorr = float(data.get('r', 1))
    target.par.colorg = float(data.get('g', 1))
    target.par.colorb = float(data.get('b', 1))

def _set_intensity(data):
    target = op('/project1/master_level')
    if target is None: return
    target.par.value0 = float(data.get('value', 1.0))

def _play(_data):
    if op('/project1/transport') is not None:
        op('/project1/transport').par.play = 1

def _pause(_data):
    if op('/project1/transport') is not None:
        op('/project1/transport').par.play = 0

def _reset(_data):
    if op('/project1/transport') is not None:
        op('/project1/transport').par.reset.pulse()

def _blackout(_data):
    target = op('/project1/master_level')
    if target is not None:
        target.par.value0 = 0.0


ACTION_HANDLERS = {
    'triggerEffect': _trigger_effect,
    'loadScene':     _load_scene,
    'setColor':      _set_color,
    'setIntensity':  _set_intensity,
    'play':          _play,
    'pause':         _pause,
    'reset':         _reset,
    'blackout':      _blackout,
}


# Optional helpers — wire these in if you want TD to push state back to web clients.
def push_status(dat, payload):
    """Send an arbitrary dict back to all web clients."""
    dat.sendText(json.dumps(payload))

def onReceiveBinary(dat, contents):
    return

def onReceivePing(dat, contents):
    dat.sendPong(contents)
    return

def onReceivePong(dat, contents):
    return
