// Score + combo system. A piece "scores" the first time it's knocked loose
// (velocity over a threshold). Chaining smashes quickly builds a multiplier.
export function createScore({ scoreEl, comboEl }) {
  const POINTS = { brick: 10, pallet: 15, barrel: 25, crate: 20, cone: 5 }
  const COMBO_WINDOW = 2.5 // seconds to keep a chain alive
  const SMASH_SPEED = 4.0 // velocity that counts as "smashed"

  let score = 0
  let combo = 0
  let comboTimer = 0
  let armed = false // ignore smashes until the scene settles after spawn

  function arm() {
    armed = true
  }

  function reset() {
    score = 0
    combo = 0
    comboTimer = 0
    armed = false
    renderScore()
    renderCombo()
  }

  function multiplier() {
    return Math.min(1 + Math.floor(combo / 3), 8) // x1, then +1 every 3 hits, cap x8
  }

  function registerSmash(type) {
    combo += 1
    comboTimer = COMBO_WINDOW
    const pts = (POINTS[type] ?? 10) * multiplier()
    score += pts
    renderScore()
    renderCombo()
    return pts
  }

  // Scan scorable pieces; award points for any newly knocked loose.
  // A piece must first settle (rest) before it can score — so spawn jitter
  // and pieces that roll off on their own never count.
  function detect(scorables) {
    if (!armed) return
    for (const s of scorables) {
      if (s.scored) continue
      const v = s.body.linvel()
      const sp2 = v.x * v.x + v.y * v.y + v.z * v.z
      if (!s.settled) {
        if (sp2 < 0.25) s.settled = true
        continue
      }
      if (sp2 > SMASH_SPEED * SMASH_SPEED) {
        s.scored = true
        registerSmash(s.type)
      }
    }
  }

  function update(dt) {
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) {
        combo = 0
        renderCombo()
      }
    }
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = score.toLocaleString()
  }

  function renderCombo() {
    if (!comboEl) return
    const m = multiplier()
    if (combo >= 2 && m > 1) {
      comboEl.textContent = `COMBO x${m}`
      comboEl.classList.add('show')
      // retrigger the pop animation
      comboEl.classList.remove('pop')
      void comboEl.offsetWidth
      comboEl.classList.add('pop')
    } else {
      comboEl.classList.remove('show')
    }
  }

  renderScore()
  return { detect, update, registerSmash, arm, reset, get score() { return score } }
}
