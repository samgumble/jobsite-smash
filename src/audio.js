// Procedural audio via Web Audio API (no asset files).
// - A looping diesel engine whose pitch/volume track speed + throttle.
// - One-shot filtered-noise "thud" for impacts.
export function createAudio() {
  let ctx = null
  let master = null
  let engineOsc1 = null
  let engineOsc2 = null
  let engineFilter = null
  let engineGain = null
  let rumbleLfo = null
  let noiseBuffer = null
  let started = false

  // Must be called from a user gesture (autoplay policy).
  function resume() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume()
      return
    }
    started = true
    ctx = new (window.AudioContext || window.webkitAudioContext)()

    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)

    // pre-baked white noise for impacts
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    // engine: two detuned saws through a lowpass = diesel rumble
    engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 320

    engineGain = ctx.createGain()
    engineGain.gain.value = 0.0

    engineOsc1 = ctx.createOscillator()
    engineOsc1.type = 'sawtooth'
    engineOsc1.frequency.value = 45
    engineOsc2 = ctx.createOscillator()
    engineOsc2.type = 'square'
    engineOsc2.frequency.value = 67

    // slow LFO wobble on volume for an idling-engine feel
    rumbleLfo = ctx.createOscillator()
    rumbleLfo.frequency.value = 7
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.015
    rumbleLfo.connect(lfoGain)
    lfoGain.connect(engineGain.gain)

    engineOsc1.connect(engineFilter)
    engineOsc2.connect(engineFilter)
    engineFilter.connect(engineGain)
    engineGain.connect(master)

    engineOsc1.start()
    engineOsc2.start()
    rumbleLfo.start()
  }

  // speed: m/s (abs), throttle: 0..1
  function setEngine(speed, throttle) {
    if (!started) return
    const s = Math.abs(speed)
    const base = 42 + throttle * 26 + s * 3.2
    const t = ctx.currentTime
    engineOsc1.frequency.setTargetAtTime(base, t, 0.08)
    engineOsc2.frequency.setTargetAtTime(base * 1.5, t, 0.08)
    engineFilter.frequency.setTargetAtTime(280 + s * 55 + throttle * 250, t, 0.08)
    const vol = 0.05 + throttle * 0.06 + Math.min(s / 25, 1) * 0.05
    engineGain.gain.setTargetAtTime(vol, t, 0.1)
  }

  // intensity 0..1 — louder/deeper thud for bigger hits
  function thud(intensity = 0.5) {
    if (!started) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 200 + intensity * 700
    const g = ctx.createGain()
    const peak = 0.25 + intensity * 0.5
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + intensity * 0.18)
    src.connect(filter)
    filter.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + 0.4)
  }

  return { resume, setEngine, thud }
}
