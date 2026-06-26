// Unified input: keyboard (WASD / arrows / space) + on-screen touch buttons.
// Exposes a plain state object the vehicle reads each frame.

export function createControls() {
  const state = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  }

  // --- Keyboard ---
  const keyMap = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'backward',
    ArrowDown: 'backward',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    Space: 'brake',
  }

  function onKey(down) {
    return (e) => {
      const action = keyMap[e.code]
      if (action) {
        state[action] = down
        e.preventDefault()
      }
    }
  }
  window.addEventListener('keydown', onKey(true))
  window.addEventListener('keyup', onKey(false))

  // --- Touch (only built on touch-capable devices) ---
  if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
    buildTouchUI(state)
  }

  return state
}

function buildTouchUI(state) {
  const css = document.createElement('style')
  css.textContent = `
    .touch-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10;
      font-family: system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
    .touch-btn { position: absolute; pointer-events: auto; display: flex;
      align-items: center; justify-content: center; width: 76px; height: 76px;
      border-radius: 50%; background: rgba(20,20,28,0.38); color: #fff;
      border: 2px solid rgba(255,255,255,0.35); font-size: 30px; font-weight: 700;
      backdrop-filter: blur(2px); touch-action: none; }
    .touch-btn:active { background: rgba(255,82,0,0.75); border-color: #ff5200; }
    .tb-up    { left: 96px; bottom: 150px; }
    .tb-down  { left: 96px; bottom: 56px; }
    .tb-left  { left: 24px; bottom: 103px; }
    .tb-right { left: 168px; bottom: 103px; }
    .tb-brake { right: 32px; bottom: 72px; width: 96px; height: 96px;
      font-size: 18px; background: rgba(190,40,40,0.45); }
  `
  document.head.appendChild(css)

  const ui = document.createElement('div')
  ui.className = 'touch-ui'
  ui.innerHTML = `
    <div class="touch-btn tb-up"    data-act="forward">▲</div>
    <div class="touch-btn tb-down"  data-act="backward">▼</div>
    <div class="touch-btn tb-left"  data-act="left">◀</div>
    <div class="touch-btn tb-right" data-act="right">▶</div>
    <div class="touch-btn tb-brake" data-act="brake">BRAKE</div>
  `
  document.body.appendChild(ui)

  ui.querySelectorAll('.touch-btn').forEach((btn) => {
    const act = btn.dataset.act
    const press = (e) => { state[act] = true; e.preventDefault() }
    const release = (e) => { state[act] = false; e.preventDefault() }
    btn.addEventListener('pointerdown', press)
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    btn.addEventListener('pointerleave', release)
  })
}
