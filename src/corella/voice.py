"""Voice testing: the simulated customer speaks (Indian-accent TTS, with real-world noise), the agent's spoken reply
is transcribed back, and every turn's response time is measured.

Pipeline per customer turn:  text -> TTS (Sarvam Bulbul) -> noise/line effects -> agent (audio in, audio or text out)
                             -> STT of the agent's audio (Sarvam Saaras) -> transcript + latency.

Audio is 16 kHz mono 16-bit WAV throughout. Noise is synthesised (no sample files needed) and mixed at a target SNR.
"""
from __future__ import annotations

import base64
import io
import math
import random
import time
import wave
from array import array

import httpx

from .config import settings

RATE = 16000
LANGUAGES = ["hi-IN", "en-IN", "bn-IN", "mr-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "gu-IN", "pa-IN", "od-IN"]
NOISES = {
    "clean": "Quiet room",
    "street": "Busy street: traffic rumble and horns (SNR ~12 dB)",
    "crowd": "Crowded market or office: background voices (SNR ~10 dB)",
    "bad_line": "Weak mobile network: narrowband audio with dropouts",
}


class VoiceError(RuntimeError):
    pass


# ---------------- WAV helpers ----------------

def wav_bytes(samples: array, rate: int = RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.tobytes())
    return buf.getvalue()


def read_wav(data: bytes) -> tuple[array, int]:
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            if w.getsampwidth() != 2:
                raise VoiceError("Only 16-bit WAV audio is supported")
            rate, ch, raw = w.getframerate(), w.getnchannels(), w.readframes(w.getnframes())
    except wave.Error as e:
        raise VoiceError(f"Not a valid WAV file: {e}") from None
    s = array("h")
    s.frombytes(raw)
    if ch > 1:  # downmix
        s = array("h", (int(sum(s[i:i + ch]) / ch) for i in range(0, len(s), ch)))
    return s, rate


def duration_ms(data: bytes) -> int:
    try:
        s, rate = read_wav(data)
        return int(len(s) * 1000 / rate)
    except VoiceError:
        return 0


# ---------------- noise ----------------

def _rms(x) -> float:
    return math.sqrt(sum(v * v for v in x) / max(len(x), 1)) or 1.0


def _clip(v: float) -> int:
    return max(-32768, min(32767, int(v)))


def add_noise(data: bytes, profile: str = "clean", seed: int | None = None) -> bytes:
    """Mix synthetic real-world noise into speech. Deterministic for a given seed."""
    if profile == "clean" or profile not in NOISES:
        return data
    speech, rate = read_wav(data)
    rng = random.Random(seed)
    n = len(speech)
    if profile == "bad_line":
        # narrowband (crude low-pass ~3.4 kHz), light hiss, and 40-120 ms dropouts every ~1.2 s
        out, prev = array("h", [0]) * n, 0.0
        for i, v in enumerate(speech):
            prev = prev + 0.55 * (v - prev)
            out[i] = _clip(prev + rng.gauss(0, 250))
        i = int(rate * rng.uniform(0.4, 1.0))
        while i < n:
            gap = int(rate * rng.uniform(0.04, 0.12))
            for j in range(i, min(n, i + gap)):
                out[j] = 0
            i += gap + int(rate * rng.uniform(0.8, 1.6))
        return wav_bytes(out, rate)

    noise = [0.0] * n
    if profile == "street":
        brown = 0.0
        for i in range(n):  # traffic rumble: brown noise
            brown = 0.995 * brown + rng.gauss(0, 1)
            noise[i] = brown
        t = int(rate * rng.uniform(0.3, 1.5))
        while t < n:  # occasional horns
            f, length = rng.choice([420, 510, 640]), int(rate * rng.uniform(0.15, 0.4))
            for j in range(t, min(n, t + length)):
                noise[j] += 25 * math.sin(2 * math.pi * f * j / rate)
            t += length + int(rate * rng.uniform(1.5, 3.5))
        snr_db = 12
    else:  # crowd: several amplitude-modulated band-limited noise sources ~ babble
        for _ in range(5):
            lp, phase, rate_mod = 0.0, rng.uniform(0, 6.28), rng.uniform(2, 5)
            for i in range(n):
                lp += 0.15 * (rng.gauss(0, 1) - lp)
                env = 0.5 + 0.5 * math.sin(phase + 2 * math.pi * rate_mod * i / rate)
                noise[i] += lp * env
        snr_db = 10
    scale = _rms(speech) / (_rms(noise) * 10 ** (snr_db / 20))
    return wav_bytes(array("h", (_clip(s + scale * z) for s, z in zip(speech, noise))), rate)


# ---------------- speech providers ----------------

class Voice:
    name = "base"

    def tts(self, text: str, language: str) -> bytes:
        raise NotImplementedError

    def stt(self, audio: bytes, language: str) -> str:
        raise NotImplementedError


class SarvamVoice(Voice):
    """Sarvam AI: Bulbul TTS and Saaras STT, built for Indian languages and code-mixed speech."""
    name = "sarvam"
    API = "https://api.sarvam.ai"

    def __init__(self, key: str | None = None):
        self.key = key or settings.sarvam_api_key
        if not self.key:
            raise VoiceError("Voice testing needs SARVAM_API_KEY")

    def _call(self, path: str, **kw) -> dict:
        for attempt in range(3):
            try:
                r = httpx.post(f"{self.API}{path}", headers={"api-subscription-key": self.key}, timeout=60, **kw)
            except httpx.TransportError as e:
                if attempt == 2:
                    raise VoiceError(f"Sarvam unreachable: {type(e).__name__}") from None
                time.sleep(2 ** attempt)
                continue
            if r.status_code in (429, 500, 503) and attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            if r.status_code >= 400:
                raise VoiceError(f"Sarvam {path} HTTP {r.status_code}: {r.text[:300]}")
            return r.json()
        raise VoiceError("Sarvam failed after retries")

    def tts(self, text, language):
        out = self._call("/text-to-speech", json={
            "text": text[:2400], "language_code": language if language in LANGUAGES else "hi-IN",
            "model": settings.sarvam_tts_model, "speech_sample_rate": RATE, "output_audio_codec": "wav"})
        return base64.b64decode(out["audios"][0])

    def stt(self, audio, language):
        out = self._call("/speech-to-text", files={"file": ("audio.wav", audio, "audio/wav")},
                         data={"model": settings.sarvam_stt_model, "language_code": language or "unknown"})
        return (out.get("transcript") or "").strip()


class MockVoice(Voice):
    """Offline stand-in for tests and demos without a key: short WAV clips that 'contain' their text."""
    name = "mock"
    _store: dict[str, str] = {}

    def tts(self, text, language):
        n = max(1600, min(len(text) * 400, RATE * 8))  # ~25 ms per character
        tone = array("h", (int(3000 * math.sin(2 * math.pi * 220 * i / RATE)) for i in range(n)))
        self._store[str(n)] = text  # keyed by length, so noise (which keeps the length) doesn't lose it
        return wav_bytes(tone)

    def stt(self, audio, language):
        try:
            return self._store.get(str(len(read_wav(audio)[0])), "[unclear audio]")
        except VoiceError:
            return "[unclear audio]"


def get_voice(provider: str | None = None) -> Voice:
    provider = provider or settings.voice_provider or ("sarvam" if settings.sarvam_api_key else "")
    if provider == "sarvam":
        return SarvamVoice()
    if provider == "mock" or settings.env != "production":
        return MockVoice()
    # never silently fake speech for paying customers
    raise VoiceError("Voice testing is not enabled on this server yet (SARVAM_API_KEY missing)")


# ---------------- voice targets ----------------

from .engine import DemoEmiBot, Target, TargetError, _dig, _post  # noqa: E402


class VoiceTurn(str):
    """An agent reply that also carries voice measurements (a str, so the text pipeline is unchanged)."""
    meta: dict

    def __new__(cls, text: str, **meta):
        obj = super().__new__(cls, text)
        obj.meta = meta
        return obj


class VoiceHttpTarget(Target):
    """A voice agent reachable over HTTPS, one turn per request.

    Request (json): {"audio": <base64 WAV 16 kHz mono>, "format": "wav", "sample_rate": 16000,
                     "language": "hi-IN", "session_id": "..."}   or multipart with an `audio` file + same fields.
    Response: JSON with base64 audio at `reply_audio_field` (we transcribe it), or text at `reply_text_field`.
    """

    def __init__(self, url: str, voice: Voice, headers: dict | None = None, language: str = "hi-IN",
                 noise: str = "clean", request_format: str = "json", reply_audio_field: str | None = "audio",
                 reply_text_field: str | None = None):
        self.url, self.voice, self.headers, self.language, self.noise = url, voice, headers or {}, language, noise
        self.request_format, self.reply_audio_field, self.reply_text_field = request_format, reply_audio_field, reply_text_field

    def _send(self, audio: bytes, session: str):
        fields = {"format": "wav", "sample_rate": RATE, "language": self.language, "session_id": session}
        if self.request_format == "multipart":
            try:
                r = httpx.post(self.url, files={"audio": ("turn.wav", audio, "audio/wav")},
                               data={k: str(v) for k, v in fields.items()}, headers=self.headers, timeout=60)
            except httpx.TimeoutException:
                raise TargetError("Agent did not answer within 60s") from None
            except httpx.TransportError as e:
                raise TargetError(f"Could not reach the agent: {type(e).__name__}") from None
            if r.status_code >= 400:
                raise TargetError(f"Agent returned HTTP {r.status_code}: {r.text[:300]}")
            try:
                return r.json()
            except ValueError:
                raise TargetError("Agent did not return JSON") from None
        return _post(self.url, {"audio": base64.b64encode(audio).decode(), **fields}, self.headers)

    def reply(self, messages, session=None):
        session = session or "corella-test"
        text = messages[-1]["content"]
        spoken = add_noise(self.voice.tts(text, self.language), self.noise, seed=hash((session, len(messages))))
        start = time.monotonic()
        data = self._send(spoken, session)
        latency = int((time.monotonic() - start) * 1000)
        try:
            if self.reply_text_field:
                return VoiceTurn(str(_dig(data, self.reply_text_field)), latency_ms=latency, noise=self.noise)
            audio = base64.b64decode(_dig(data, self.reply_audio_field or "audio"))
        except (KeyError, IndexError, TypeError, ValueError):
            raise TargetError(f"No reply at '{self.reply_text_field or self.reply_audio_field}' in the agent's response") from None
        return VoiceTurn(self.voice.stt(audio, self.language), latency_ms=latency, noise=self.noise,
                         reply_audio_ms=duration_ms(audio))


class DemoVoiceTarget(Target):
    """The demo collections bot behind a real speech loop: it only 'hears' what speech recognition makes of the
    noisy customer audio, so you can see how noise and accents change what a voice agent understands."""

    def __init__(self, voice: Voice, language: str = "hi-IN", noise: str = "street"):
        self.voice, self.language, self.noise, self.bot = voice, language, noise, DemoEmiBot()

    def reply(self, messages, session=None):
        start = time.monotonic()
        spoken = add_noise(self.voice.tts(messages[-1]["content"], self.language), self.noise,
                           seed=hash((session, len(messages))))
        heard = self.voice.stt(spoken, self.language)
        answer = self.bot.reply(messages[:-1] + [{"role": "user", "content": heard}])
        said = self.voice.stt(self.voice.tts(answer, self.language), self.language)
        return VoiceTurn(said, latency_ms=int((time.monotonic() - start) * 1000), noise=self.noise, agent_heard=heard)
