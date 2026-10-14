#!/usr/bin/env python3
"""速通片 15 秒配乐模板 —— 纯代码合成，不用任何采样。乐谱是一段原创示例（D 小调），换成你自己的即可。

运行：
  uv run --with numpy --with scipy --with soundfile python scripts/audio/synth_艺术史速通.py
输出：脚本同目录 示例配乐.wav（48k / 立体声 / 15.06s）

方法见 references/风格配方/_音轨_艺术史速通.md：128 BPM 严格网格（八分音符 0.23431s，网格零点 0.028s），
17 个时代按八分音符数 6,4,4,4,4,4,3,3,3,3,2,2,2,1,1,1,9 依次排布（这是独立配乐示例，换片子时按实际段落表重排），
每个时代换一套配器，一个三音动机换乐器、随和弦移调；13.155s 音乐停，接音效（拍杯叮、滑哨坠落、碎裂、猫叫、收尾拨弦）。
响度：逐段 K 加权响度对齐到 target 表，再整体对齐 -14 LUFS / 真峰 -1.5 dBFS。
"""
import numpy as np
import scipy.signal as ss
import soundfile as sf
from pathlib import Path

SR = 48000
N = 722944                       # Загальна тривалість самостійного прикладу — 15.0613s.
T0, E = 0.028, 0.23431           # Нуль сітки та тривалість восьмої ноти (виміряно 128.04 BPM)
rng = np.random.default_rng(7)
OUT = Path(__file__).with_name("示例配乐.wav")

L = np.zeros(N); R = np.zeros(N)


def tt(n):                        # Абсолютний час восьмої ноти n
    return T0 + n * E


NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    s = NOTE[name[0]]; i = 1
    while name[i] in "#b":
        s += 1 if name[i] == "#" else -1; i += 1
    midi = 12 * (int(name[i:]) + 1) + s
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0):
    """等功率声像放进总线。pan -1..1"""
    s = int(round(t * SR))
    if s >= N or len(sig) == 0:
        return
    sig = sig[: N - s] * gain
    a = (pan + 1) * np.pi / 4
    L[s:s + len(sig)] += sig * np.cos(a)
    R[s:s + len(sig)] += sig * np.sin(a)


# ---------------------------------------------------------------- Базові компоненти
def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def adsr(dur, a=0.01, d=0.05, s=0.8, r=0.1):
    """dur 为按住时长，返回长度 dur+r 的包络"""
    t = tvec(dur + r)
    e = np.where(t < a, t / max(a, 1e-4), 0)
    m = (t >= a) & (t < a + d); e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    m = (t >= a + d) & (t < dur); e[m] = s
    lvl = s if dur > a + d else max(e[t < dur][-1] if (t < dur).any() else 0, 0)
    m = t >= dur; e[m] = lvl * np.exp(-(t[m] - dur) / max(r / 4, 1e-4))
    return e


def additive(f, amps, dur, phase_jitter=True):
    """f 可以是常数或逐样本频率数组；amps[k] 是第 k+1 次谐波幅度。带限到 18k。"""
    n = int(dur * SR) if np.isscalar(f) else len(f)
    fa = np.full(n, f) if np.isscalar(f) else f
    ph = 2 * np.pi * np.cumsum(fa) / SR
    out = np.zeros(n); fmax = fa.max()
    for k, a in enumerate(amps, 1):
        if a == 0 or k * fmax > 18000:
            continue
        p0 = rng.uniform(0, 2 * np.pi) if phase_jitter else 0
        out += a * np.sin(k * ph + p0)
    return out


def saw_amps(n=40):
    return [1 / k for k in range(1, n + 1)]


def square_amps(n=40):
    return [1 / k if k % 2 else 0 for k in range(1, n + 1)]


ATT = 0.010                      # Пом’якшення атаки: різка атака 2ms звучить надто уривчасто, 10ms дає зв’язніший звук.


def pluck(f, dur, amps, d0=3.0, slope=0.6, B=0.0, noise=0.02, bend=0.0, att=None):
    """拨弦/击弦：各次谐波独立指数衰减，高次衰减更快；B 为弦的非谐性；bend 为起音音高回落（半音）。
    v2：基音 att 秒线性起音，高次谐波起音更慢（模拟滤波包络从闭到开），起音噪声减半。"""
    att = ATT if att is None else att
    t = tvec(dur); out = np.zeros_like(t)
    fb = f * 2 ** (bend * np.exp(-t / 0.03) / 12) if bend else np.full_like(t, f)
    ph = 2 * np.pi * np.cumsum(fb) / SR
    for k, a in enumerate(amps, 1):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 18000 or a == 0:
            continue
        ak = min(att * (1 + 0.6 * (k - 1)), 0.035)          # Вищі гармоніки вступають пізніше.
        out += a * np.exp(-t * d0 * (1 + slope * (k - 1))) * np.minimum(1, t / ak) * np.sin(ph * fk / f + rng.uniform(0, 6.28))
    if noise:
        nb = rng.standard_normal(len(t)) * np.exp(-t / 0.006) * noise * 0.5
        out += lp(hp(nb, 2000), 7000)
    return out


def bp(x, lo, hi, order=2):
    return ss.sosfilt(ss.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, fc, "high", fs=SR, output="sos"), x)


def lp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, fc, "low", fs=SR, output="sos"), x)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def expdec(dur, tau):
    return np.exp(-tvec(dur) / tau)


# ---------------------------------------------------------------- Інструменти
def bone_flute(n, dur):          # Печера: майже чиста синусоїда + придих, повільна атака
    f = hz(n); held = dur
    t = tvec(held + 0.3)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.2)
    tone = additive(f * vib, [1, 0.018, 0.022, 0.012], held + 0.3)
    breath = bp(noise(held + 0.3), f * 0.8, f * 3.5) * 0.05
    return (tone + breath) * adsr(held, a=0.07, d=0.1, s=0.9, r=0.3)[: len(t)]


def frame_drum():                # Печера: низький ручний барабан, 98→87Hz
    t = tvec(0.5); f = 87 + 14 * np.exp(-t / 0.04)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    skin = lp(noise(0.5), 900) * np.exp(-t / 0.02) * 0.3
    return body + skin


def stick_click(level=1.0):      # Високочастотні частинки удару/струшування
    t = tvec(0.04)
    return bp(noise(0.04), 4000, 11000) * np.exp(-t / 0.006) * level


def harp(n, dur=0.6, bright=1.0):     # Єгипетська арфа: H2≈-11dB, спад приблизно 15dB за 0.2s
    return pluck(hz(n), dur, [1, 0.3 * bright, 0.07, 0.12, 0.015, 0.015, 0.02], d0=6.0, slope=0.5, noise=0.03)


def sistrum():                   # Єгипетський систр: короткий шум із металевими обертонами
    t = tvec(0.12)
    jing = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (5120, 6890, 8230)) * 0.15
    return (bp(noise(0.12), 6000, 12000) + jing) * np.exp(-t / 0.025)


def lyre(n, dur=0.8):            # Грецька ліра: приглушені щипкові струни
    return pluck(hz(n), dur, [1, 0.45, 0.3, 0.12, 0.05, 0.03], d0=3.5, slope=0.7, noise=0.02)


def aulos(n, dur):               # Грецький авлос: яскравий тростинний звук, сильні H2/H3, тривале звучання
    f = hz(n); t = tvec(dur + 0.06)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * t) * np.minimum(1, t / 0.15)
    tone = additive(f * vib, [1, 0.4, 0.6, 0.35, 0.06, 0.035, 0.11, 0.06], dur + 0.06)
    tone += bp(noise(dur + 0.06), f, f * 4) * 0.03
    return tone * adsr(dur, a=0.05, d=0.05, s=0.9, r=0.06)


def tambourine():
    t = tvec(0.35)
    return bp(noise(0.35), 7000, 14000) * np.exp(-t / 0.09) * (1 + 0.5 * np.sin(2 * np.pi * 28 * t))


def brass(n, dur):               # Римський ріг: пилкоподібна хвиля + фільтр низьких частот, що додає яскравості за огинаючою
    f = hz(n); tot = dur + 0.08
    raw = additive(f, saw_amps(30), tot)
    env = adsr(dur, a=0.03, d=0.12, s=0.6, r=0.08)
    t = tvec(tot)
    # Два етапи низькочастотної фільтрації наближено відтворюють «відкриття, яскравість і закриття».
    bright = lp(raw, min(f * 10, 12000)); dull = lp(raw, min(f * 4, 7000))
    w = np.exp(-t / 0.12)
    return (bright * w + dull * (1 - w)) * env


def war_drum():                  # Римський бойовий барабан ~87Hz
    t = tvec(0.45); f = 70 + 30 * np.exp(-t / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13) + lp(noise(0.45), 1500) * np.exp(-t / 0.015) * 0.5


def organ(n, dur):               # Готичний орган: H1 + непарні/високі регістри, майже без спаду
    f = hz(n); tot = dur + 0.15; t = tvec(tot)
    trem = 1 + 0.03 * np.sin(2 * np.pi * 5.5 * t)
    tone = additive(f, [1, 0.03, 0.05, 0.12, 0.18, 0.04, 0.0, 0.06, 0.03, 0.05, 0.02, 0.04, 0, 0.03, 0, 0.03], tot) * trem  # Наприкінці — мікстурний регістр (високі частоти).
    return tone * adsr(dur, a=0.035, d=0.02, s=1.0, r=0.15)


def harpsichord(n, dur=0.5):     # Ренесансний клавесин: носовий тембр (виражена H5), помірний спад
    return pluck(hz(n), dur, [1, 0.12, 0.045, 0.06, 0.14, 0.02, 0.03, 0.025] + [0.02] * 10, d0=2.2, slope=0.12, noise=0.08)


def viol(n, dur):                # Басова віола: м’які смичкові струни
    f = hz(n); tot = dur + 0.12
    raw = lp(additive(f, saw_amps(20), tot), 1200)
    return raw * adsr(dur, a=0.06, d=0.1, s=0.85, r=0.12)


def koto(n, dur=0.35):           # Укійо-е: кото/сямісен, швидкий спад + зниження висоти на атаці
    return pluck(hz(n), dur, [1, 0.55, 0.12, 0.13, 0.13, 0.06, 0.04], d0=14, slope=0.4, noise=0.06, bend=0.6)


def taiko():
    t = tvec(0.6); f = 58 + 40 * np.exp(-t / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2) + lp(noise(0.6), 700) * np.exp(-t / 0.03) * 0.4


def hyoshigi():                  # Хьосіґі (дерев’яні тріскачки)
    t = tvec(0.06)
    return (bp(noise(0.06), 1800, 4200, 4) + np.sin(2 * np.pi * 2650 * t) * 0.6) * np.exp(-t / 0.012)


def soft_piano(n, dur=0.9):      # Імпресіонізм: м’яке фортепіано/челеста, близьке до синусоїди
    return pluck(hz(n), dur, [1, 0.16, 0.08, 0.04, 0.025, 0.015, 0.012, 0.01, 0.008], d0=2.6, slope=0.45, B=0.0002, noise=0.03)


def pizz(n, dur=0.3):            # Ван Гог: яскраві щипкові струни (дуже сильні H2/H3), швидкий спад
    return pluck(hz(n), dur, [1, 0.9, 0.6, 0.22, 0.35, 0.14, 0.09, 0.05], d0=18, slope=0.3, noise=0.04)


def swirl(dur):                  # Ван Гог: висхідний шум вітру
    x = noise(dur); n = len(x); out = np.zeros(n); seg = 2400
    for i in range(0, n, seg):
        fc = 2500 + 6000 * i / n
        out[i:i + seg] = bp(x[max(0, i - 400):i + seg], fc * 0.7, fc * 1.3)[-len(out[i:i + seg]):]
    return out * np.sin(np.pi * np.arange(n) / n)


def celesta(n, dur=0.35):        # Ар-нуво: челеста/арфа, швидкий спад
    return pluck(hz(n), dur, [1, 0.6, 0.12, 0.1, 0.12, 0.12, 0.2, 0.06], d0=11, slope=0.3, noise=0.02)


def blip(n, dur=0.2):            # Баугауз: короткий геометричний звук (подібний до маримби)
    return pluck(hz(n), dur, [1, 0.75, 0.2, 0.4], d0=22, slope=0.4, noise=0.0)


def tick():
    t = tvec(0.015)
    return hp(noise(0.015), 6000) * np.exp(-t / 0.003)


def kick(f0=150, f1=48, tau=0.18, dur=0.35):
    t = tvec(dur); f = f1 + (f0 - f1) * np.exp(-t / 0.025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau) + hp(noise(dur), 3000) * np.exp(-t / 0.003) * 0.15


def clap():
    t = tvec(0.18); env = np.zeros_like(t)
    for d in (0, 0.009, 0.018):
        env += (t >= d) * np.exp(-np.maximum(t - d, 0) / (0.006 if d < 0.018 else 0.05))
    return bp(noise(0.18), 1200, 6000) * env


def hat(open_=False):
    d = 0.09 if open_ else 0.03; t = tvec(d)
    return hp(noise(d), 7500, 4) * np.exp(-t / (d / 3))


def chip(n, dur, duty_sq=True):  # Пікселі: прямокутна хвиля (лише непарні гармоніки)
    f = hz(n); tot = dur + 0.01
    return additive(f, square_amps(40), tot, phase_jitter=False) * adsr(dur, a=0.006, d=0.0, s=1.0, r=0.01)


def supersaw(n, dur):            # Трасування променів: багатошарові розстроєні пилкоподібні хвилі, скляний тембр
    f = hz(n); tot = dur + 0.15; out = 0
    for det in (-0.012, -0.005, 0, 0.006, 0.013):
        out = out + additive(f * (1 + det), saw_amps(25), tot)
    out = lp(out / 5, 7000)
    return out * adsr(dur, a=0.04, d=0.1, s=0.7, r=0.15)


def boing(t0=11.01, t1=11.165, f0=600, f1=985):   # Кіт стрибає на стіл: висхідне глісандо
    t = tvec(t1 - t0); f = f0 * (f1 / f0) ** (t / t[-1])
    tone = additive(f, [1, 0.5, 0.35, 0.2, 0.1], len(t) / SR)
    return tone * np.sin(np.pi * t / t[-1]) ** 0.5


def pluck2026(n, dur=0.22):      # 2026: синтетичний щипковий звук на основі прямокутної хвилі (слабка H2, сильна H3) + фільтр низьких частот за огинаючою
    f = hz(n); tot = dur
    raw = additive(f, [1, 0.1, 0.38, 0.3, 0.22, 0.12, 0.14, 0.1, 0.08], tot)
    return raw * np.exp(-tvec(tot) / 0.1) * np.minimum(1, tvec(tot) / 0.014)


def sub_bass(n, dur):            # 2026: пилкоподібний бас + синусоїда октавою нижче
    f = hz(n); tot = dur + 0.15
    raw = lp(additive(f, saw_amps(30), tot), 700, 4) + 0.6 * np.sin(2 * np.pi * f / 2 * tvec(tot))
    return raw * adsr(dur, a=0.01, d=0.05, s=0.9, r=0.15)


def pad(n, dur):
    f = hz(n); tot = dur + 0.1
    return lp(additive(f, saw_amps(15), tot), 2500) * adsr(dur, a=0.05, d=0.1, s=0.7, r=0.1)


# ---------------------------------------------------------------- Звукові ефекти
def tink():                      # 13.16 Лапа кота торкається чашки: високочастотний негармонічний дзвін кераміки
    t = tvec(0.35); out = 0
    for f, a, tau in ((5720, 1, 0.12), (6506, 0.6, 0.09), (6315, 0.25, 0.1), (5490, 0.35, 0.08), (1533, 0.1, 0.05)):
        out = out + a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    return out


def swipe():                     # Свист помаху лапи
    d = 0.2; t = tvec(d)
    return bp(noise(d), 2500, 9000) * np.sin(np.pi * t / d) ** 2


def slide_whistle(t0=13.29, t1=13.635, f0=1550, f1=325):   # Падіння чашки: синусоїда з експоненційним зниженням частоти
    t = tvec(t1 - t0); f = f0 * (f1 / f0) ** (t / t[-1])
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(1, t / 0.015) * np.minimum(1, (t[-1] - t) / 0.01 + 0.0001)
    return tone * env


def crash():                     # 13.624 Розбиття: глухий удар 83Hz + високочастотні уламки + негармонічний післязвук
    d = 0.6; t = tvec(d)
    f = 60 + 40 * np.exp(-t / 0.02)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    hiss = hp(noise(d), 2500) * np.exp(-t / 0.13)
    shards = np.zeros_like(t)
    for _ in range(14):                      # Кілька дрібних повторних зіткнень уламків
        s = rng.uniform(0.02, 0.4); i = int(s * SR); g = rng.uniform(0.2, 0.7) * np.exp(-s / 0.2)
        seg = hp(noise(0.03), 4000) * np.exp(-tvec(0.03) / 0.005) * g
        shards[i:i + len(seg)] += seg[: len(shards) - i]
    ring = sum(a * np.sin(2 * np.pi * fr * t) * np.exp(-t / tau)
               for fr, a, tau in ((1669, .25, .15), (2302, .2, .1), (4462, .12, .08), (7320, .3, .12), (7921, .25, .1)))
    return thump * 1.2 + hiss * 0.6 + shards + ring


def meow(t0=14.12, tp=14.28, t1=14.65):   # Нявкання: підйом 574→797Hz, потім спад до 486Hz; пилкоподібна хвиля + форманти
    n = int((t1 - t0) * SR); t = np.arange(n) / SR; ip = int((tp - t0) * SR)
    f = np.empty(n); f[:ip] = np.linspace(574, 797, ip); f[ip:] = np.linspace(797, 486, n - ip)
    raw = additive(f, saw_amps(24), n / SR)
    vowel = 0.5 * bp(raw, 1300, 1900) + 1.0 * bp(raw, 2100, 2700) + 0.9 * bp(raw, f.mean() * 0.8, f.mean() * 1.3) + 0.15 * raw
    env = np.minimum(1, t / 0.04) * np.minimum(1, (t[-1] - t) / 0.12)
    return vowel * env


def end_thump(f=90, sparkle=True):     # Легкий «поп» під час появи підпису
    d = 0.2; t = tvec(d)
    out = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.05)
    if sparkle:
        out += sum(0.08 * np.sin(2 * np.pi * fr * t) * np.exp(-t / 0.06) for fr in (531, 852, 921, 965, 1058))
    return out


# ---------------------------------------------------------------- Аранжування (одиниця часу: восьма нота)
def era(n0, items):
    """items: (相对八分位置, 生成函数, 增益, 声像)"""
    for pos, fn, g, pan in items:
        add(fn(), tt(n0 + pos), g, pan)


B8 = E                                            # Тривалість восьмої ноти в секундах

# ---- Оригінальна партитура прикладу (ре мінор / фа мажор, гармонічна основа Dm–B♭–F–C) ----
# Наскрізний мотив: ♪♪♩ «поступово вгору, потім стрибок униз»; інструмент змінюється в кожній частині, мотив транспонується за її акордом. У печерній частині спершу утверджується розширена низхідна версія.
# 1 Печера (6 восьмих): кістяна флейта A4–G4–D4 (низхідно, початок із чверті з крапкою) + ручний барабан + удари на слабкі долі
era(0, [(0, lambda: bone_flute("A4", 3 * B8), 1.0, 0), (3, lambda: bone_flute("G4", B8), 1.0, 0),
        (4, lambda: bone_flute("D4", 2.4 * B8), 1.0, 0),
        (0, frame_drum, 1.3, -0.1), (3, frame_drum, 1.1, -0.1)]
    + [(k, lambda: stick_click(0.25), 1.0, 0.25) for k in (1, 2, 4, 5)])

# 2 Єгипет (4): арфа, арпеджіо Dm→B♭ + мотив F5–G5–D5 + систр на слабкі долі
era(6, [(0, lambda: harp("D3", 0.9), 0.55, -0.2), (0.06, lambda: harp("F3", 0.6), 0.35, -0.15),
        (0.5, lambda: harp("A3", 0.6), 0.45, -0.1), (1, lambda: harp("D4", 0.5), 0.4, -0.2),
        (2, lambda: harp("Bb2", 0.9), 0.5, -0.2), (2.06, lambda: harp("D3", 0.6), 0.35, -0.15), (3, lambda: harp("F3", 0.5), 0.4, -0.2),
        (0, lambda: harp("F5", 0.5, 1.2), 0.8, 0.1), (1, lambda: harp("G5", 0.5, 1.2), 0.8, 0.1),
        (2, lambda: harp("D5", 0.6, 1.2), 0.8, 0.1)]
    + [(k + 0.5, sistrum, 0.22, 0.3) for k in range(4)])

# 3 Греція (4): ліра, акорд B♭ + авлос D5 (♪) → F5 (чверть із крапкою)
era(10, [(0, lambda: lyre("Bb2"), 0.4, -0.25), (0.04, lambda: lyre("F3"), 0.45, -0.2), (0.08, lambda: lyre("Bb3"), 0.35, -0.15),
         (2.5, lambda: lyre("D4", 0.5), 0.35, -0.2), (3.5, lambda: lyre("F2", 0.6), 0.5, -0.2),
         (0, lambda: aulos("D5", B8), 0.55, 0.05), (1, lambda: aulos("F5", 3 * B8), 0.5, 0.05),
         (1, lambda: aulos("F6", 3 * B8), 0.15, 0.05), (0, tambourine, 0.12, 0.3), (2, tambourine, 0.08, 0.3)])

# 4 Рим (4): мотив рогу C5–D5–A4, акорди F→C→Dm + бойовий барабан
era(14, [(0, lambda: brass("C5", B8 * 0.9), 0.45, 0.05), (0, lambda: brass("F3", B8 * 0.9), 0.25, -0.15), (0, lambda: brass("A3", B8 * 0.9), 0.25, 0.15),
         (1, lambda: brass("D5", B8 * 1.4), 0.4, 0.05), (1, lambda: brass("G3", B8 * 1.4), 0.25, -0.15), (1, lambda: brass("C3", B8 * 1.8), 0.3, 0),
         (2.5, lambda: brass("A4", B8 * 1.4), 0.4, 0.05), (2.5, lambda: brass("F3", B8 * 1.4), 0.25, -0.15), (3, lambda: brass("D3", B8), 0.3, 0),
         (0, war_drum, 1.1, -0.05), (1.5, war_drum, 0.9, -0.05), (2, war_drum, 1.1, -0.05)])

# 5 Готика (4): орган Dm → Gm/D, тривалий педальний тон D2
era(18, [(0, lambda: organ("D3", 2 * B8), 0.3, -0.1), (0, lambda: organ("A3", 2 * B8), 0.25, 0.1), (0, lambda: organ("D4", 2 * B8), 0.25, -0.05),
         (0, lambda: organ("F4", 2 * B8), 0.3, 0.05), (0.5, lambda: organ("A5", 1.5 * B8), 0.12, 0),
         (2, lambda: organ("D3", 2 * B8), 0.3, -0.1), (2, lambda: organ("G3", 2 * B8), 0.3, 0.1), (2, lambda: organ("Bb3", 2 * B8), 0.3, -0.05),
         (2, lambda: organ("D4", 2 * B8), 0.2, 0.05), (2.5, lambda: organ("Bb4", 1.5 * B8), 0.15, 0), (0, lambda: organ("D2", 4 * B8), 0.18, 0)])

# 6 Ренесанс (4): мотив клавесина B♭5–C6–G5, супровід Gm→F + басова віола G2
era(22, [(0, lambda: harpsichord("Bb5"), 0.6, 0.1), (1, lambda: harpsichord("C6"), 0.6, 0.1), (2, lambda: harpsichord("G5", 0.7), 0.6, 0.1),
         (0, lambda: harpsichord("G3"), 0.3, -0.2), (0.04, lambda: harpsichord("Bb3"), 0.28, -0.15), (1, lambda: harpsichord("D4"), 0.25, -0.15),
         (2, lambda: harpsichord("F3"), 0.3, -0.2), (3, lambda: harpsichord("A3"), 0.28, -0.15), (3, lambda: harpsichord("C4"), 0.25, -0.1),
         (0, lambda: viol("G2", 3.6 * B8), 0.35, -0.05)])

# 7 Укійо-е (3): кото в ладі міякобусі від D (D–E♭–G–A–B♭) + тайко + хьосіґі
era(26, [(0, taiko, 1.2, -0.05), (1.5, taiko, 1.0, -0.05),
         (0, lambda: koto("D5"), 0.55, 0.15), (0.5, lambda: koto("A4"), 0.45, 0.15), (0.75, lambda: koto("Bb4"), 0.5, 0.15),
         (1, lambda: koto("G4"), 0.45, 0.15), (1.5, lambda: koto("A4"), 0.4, 0.15), (2, lambda: koto("Eb5"), 0.5, 0.15),
         (2.25, lambda: koto("D5"), 0.45, 0.15), (2.5, lambda: koto("A4"), 0.45, 0.15),
         (0.5, hyoshigi, 0.25, 0.3), (2, hyoshigi, 0.2, 0.3)])

# 8 Імпресіонізм (3): м’яке фортепіано A5–C6–G5, Fmaj7 → бас B♭ → забарвлення Dm9
era(29, [(0, lambda: soft_piano("A5"), 0.55, 0.1), (0, lambda: soft_piano("F3"), 0.35, -0.15), (0, lambda: soft_piano("E4"), 0.3, -0.1),
         (0.5, lambda: soft_piano("C5"), 0.3, 0), (1, lambda: soft_piano("C6"), 0.55, 0.1), (1, lambda: soft_piano("D5"), 0.3, 0),
         (1, lambda: soft_piano("F4"), 0.3, -0.1), (1, lambda: soft_piano("Bb2", 1.5), 0.55, -0.05),
         (2, lambda: soft_piano("G5"), 0.55, 0.1), (2, lambda: soft_piano("D3"), 0.3, -0.1), (2.5, lambda: soft_piano("E5"), 0.25, 0.1)])

# 9 Ван Гог (3): щипковий басовий ритм D2 + розрізнені яскраві щипкові звуки вгорі + висхідний шум вітру
era(32, [(0, lambda: pizz("D2", 0.3), 0.7, -0.05), (0.5, lambda: pizz("A2"), 0.45, -0.1), (1, lambda: pizz("D2"), 0.6, -0.05),
         (1.75, lambda: pizz("C3"), 0.5, -0.05), (2, lambda: pizz("D2"), 0.6, -0.05), (2.5, lambda: pizz("A2", 0.4), 0.5, -0.05),
         (0.25, lambda: pizz("A5"), 0.4, 0.15), (1, lambda: pizz("F5"), 0.35, 0.1), (1.75, lambda: pizz("D6"), 0.3, 0.15),
         (2.5, lambda: pizz("E5"), 0.4, 0.15),
         (1.5, lambda: swirl(0.4), 0.06, 0.2)])

# 10 Ар-нуво (3): мотив челести D5–E5–A4, бас B♭→C→Dm
era(35, [(0, lambda: celesta("D5"), 0.6, 0.1), (0.2, lambda: celesta("D6"), 0.2, 0.15), (1, lambda: celesta("E5"), 0.6, 0.1),
         (2, lambda: celesta("A4"), 0.6, 0.1),
         (0, lambda: pizz("Bb2", 0.5), 0.5, -0.05), (1, lambda: pizz("C3", 0.5), 0.45, -0.05), (1, lambda: celesta("E3", 0.5), 0.3, -0.15),
         (1, lambda: celesta("G3", 0.5), 0.25, -0.1), (2, lambda: pizz("D3", 0.5), 0.45, -0.05), (2, lambda: celesta("D4"), 0.25, -0.1),
         (2, lambda: celesta("F4"), 0.25, -0.15), (2, lambda: celesta("A4"), 0.2, 0), (0, lambda: tambourine(), 0.06, 0.3)])

# 11 Кубізм (2): навмисно дисонантні фрагментарні акорди D–G♯–C♯ → E♭–A–B♭–E
era(38, [(0, lambda: soft_piano("D2", 0.5), 0.5, -0.1), (0, lambda: soft_piano("D3", 0.5), 0.45, -0.1), (0, lambda: soft_piano("G#3", 0.5), 0.4, 0),
         (0, lambda: soft_piano("C#5", 0.5), 0.45, 0.15),
         (1, lambda: soft_piano("Eb4", 0.3), 0.4, -0.1), (1, lambda: soft_piano("A4", 0.3), 0.45, 0.1), (1, lambda: soft_piano("Bb4", 0.3), 0.35, 0),
         (1, lambda: soft_piano("E5", 0.3), 0.5, 0.15)])

# 12 Баугауз (2): накладені октави D → F/A → D, механічне цокання шістнадцятими
era(40, [(0, lambda x=x: blip(x), 0.3, p) for x, p in (("D2", 0), ("D3", -0.1), ("D4", 0.1), ("D5", -0.05), ("D6", 0.05))]
    + [(1, lambda: blip("F5"), 0.45, 0.1), (1, lambda: blip("A5"), 0.3, 0.1), (1, lambda: blip("A6"), 0.2, -0.1), (1.5, lambda: blip("D5"), 0.45, 0)]
    + [(k * 0.5, tick, 0.25, 0.3) for k in range(4)])

# 13 Попарт (2): бас-барабан + плескання на слабкі долі + короткі мультяшні звуки
era(42, [(0, lambda: kick(140, 45), 1.1, 0), (0, lambda: blip("D4", 0.2), 0.25, -0.1), (0, lambda: blip("F4", 0.2), 0.25, 0.1),
         (1, clap, 0.45, 0.1), (0.5, lambda: chip("D4", 0.09), 0.18, -0.1), (0.5, lambda: chip("F4", 0.09), 0.15, 0.1),
         (0.5, lambda: chip("C5", 0.09), 0.12, 0), (1.5, lambda: chip("D6", 0.05), 0.15, 0.2)]
    + [(k * 0.5, hat, 0.3, 0.25) for k in range(4)])

# 14 Пікселі (1): арпеджіо мажорного тризвуку F прямокутною хвилею (тридцять другі) + прямокутний бас
era(44, [(0, lambda: chip("F3", 0.2), 0.3, 0), (0, lambda: chip("F6", 0.055), 0.18, 0.1), (0.25, lambda: chip("A6", 0.05), 0.15, 0.1),
         (0.5, lambda: chip("C7", 0.055), 0.12, 0.1), (0.75, lambda: chip("F6", 0.05), 0.15, 0.1), (0, lambda: kick(120, 50, 0.08), 0.6, 0)])

# 15 Трасування променів (1): акорд B♭ на supersaw, скляний тембр
era(45, [(0, lambda x=x: supersaw(x, B8 * 1.1), 0.18, p) for x, p in (("Bb3", -0.2), ("D4", 0.2), ("F4", -0.1), ("Bb4", 0.1))]
    + [(0.5, lambda: supersaw("D5", B8 * 0.6), 0.15, 0.15), (0.5, lambda: supersaw("F3", B8 * 0.8), 0.15, -0.1),
       (0, lambda: kick(130, 50, 0.1), 0.7, 0)])

# 16 Мемфіс (1): тривалий мажорний тризвук C переходить за кінець частини + бас C + бас-барабан; висхідне глісандо стрибка кота на стіл
era(46, [(0, lambda: kick(150, 46), 1.0, 0), (0, lambda: sub_bass("C2", 0.24), 0.35, 0)]
    + [(0, lambda x=x: supersaw(x, 0.42), g, p) for x, g, p in (("C3", 0.12, -0.15), ("G3", 0.1, 0.15), ("C5", 0.16, -0.05), ("E5", 0.16, 0.1), ("G5", 0.1, 0))])
add(boing(), 11.01, 0.35, 0.0)

# 17 2026 (9): хаус 128BPM — бас-барабан на кожну долю, відкритий хай-хет на слабкі долі, пилкоподібний бас D, щипковий D-мажорний add9 (наприкінці перехід до однойменного мажору)
add(sub_bass("D2", tt(56) - tt(47)), tt(47), 0.4, 0)
for n in (48, 50, 52, 54):
    add(kick(150, 46, 0.2), tt(n), 1.0, 0)
for n in (49, 51, 53, 55):
    add(hat(True), tt(n), 0.3, 0.2)
lead = [(48, "F#5"), (49, "A5"), (50, "D6"), (51, "E6"), (52, "F#6"), (53, "E6"), (54, "D6"), (55, "B5"), (55.5, "A5")]
for n, x in lead:
    add(pluck2026(x), tt(n), 0.5, 0.1)
arp = ["A4", "D5", "F#4", "E5", "D4", "A4", "B4", "F#4"]
for k in range(18):
    n = 47 + k * 0.5
    if n >= 56:
        break
    add(pluck2026(arp[k % len(arp)], 0.15), tt(n), 0.22, -0.15)
for x, a, b in (("F#3", 50.5, 53.5), ("A3", 50.5, 53.5), ("E4", 51.5, 53.5), ("D3", 53.5, 54.3), ("F#3", 54.5, 56), ("A3", 54.5, 56), ("B3", 54.5, 56)):
    add(pad(x, tt(b) - tt(a)), tt(a), 0.07, -0.2 if x < "C" else 0.2)

# 18 Частина зі звуковими ефектами
add(tink(), 13.158, 0.12, 0.1)
add(swipe(), 13.17, 0.05, 0.2)
add(slide_whistle(), 13.29, 0.16, 0.0)
add(crash(), 13.624, 0.55, 0.0)
add(meow(), 14.12, 0.55, 0.0)
add(end_thump(88), 14.561, 0.2, 0)
add(end_thump(90), 14.796, 0.25, 0)
add(pluck(hz("D2"), 0.3, [1, 0.5, 0.35, 0.15, 0.08], d0=4, slope=0.5, noise=0.03), 14.92, 0.6, 0)   # Завершення на тоніці


# ---------------------------------------------------------------- Зведення: реверберація малої кімнати → вирівнювання гучності частин → загальні LUFS/піки
def reverb(x, seed):
    r = np.random.default_rng(seed); d = 0.5; t = tvec(d)
    ir = r.standard_normal(len(t)) * np.exp(-t / 0.09)
    ir = lp(ir, 6000); ir[: int(0.012 * SR)] = 0      # Попередня затримка 12ms для м’якшої атаки
    return ss.fftconvolve(x, ir)[: len(x)] / np.sqrt((ir ** 2).sum())


wetL, wetR = reverb(L, 1), reverb(R, 2)
L = L + 0.09 * wetL; R = R + 0.09 * wetR


def kweight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1, -1.99004745483398, 0.99007225036621]
    return ss.lfilter(b2, a2, ss.lfilter(b1, a1, x))


def seg_loud(kl, kr, s, e):
    return -0.691 + 10 * np.log10(np.mean(kl[s:e] ** 2 + kr[s:e] ** 2) + 1e-12)


def lufs(l, r):                  # Інтегрована гучність BS.1770-4 (блоки 400ms, абсолютний + відносний пороги)
    kl, kr = kweight(l), kweight(r); blk, hop = int(0.4 * SR), int(0.1 * SR)
    z = np.array([np.mean(kl[i:i + blk] ** 2 + kr[i:i + blk] ** 2) for i in range(0, len(l) - blk + 1, hop)])
    lk = -0.691 + 10 * np.log10(z + 1e-12); z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return -0.691 + 10 * np.log10(z.mean())


# Цільова гучність кожної частини (K-зважування, без порога). За наявності еталонного ролика внесіть виміряні значення його частин; тут приклад: усі музичні частини -14, ефекти трохи тихіші.
edges = [0] + [tt(n) for n in (6, 10, 14, 18, 22, 26, 29, 32, 35, 38, 40, 42, 44, 45, 46, 47)] + [13.155, 13.624, 14.1, N / SR]
target = [-14.0] * 17 + [-18.0, -17.5, -16.0]
idx = [int(round(x * SR)) for x in edges]
# Тепла низькочастотна основа: м’яка трикутна хвиля на основних тонах акордів частини + фільтр низьких частот 250Hz; рівень автоматично визначається відносно гучності частини (у цьому прикладі всюди на 18dB нижче).
BED_ROOT = ["D2", "D2", "A#1", "F2", "D2", "G2", "D2", "F2", "D2", "A#1", "D2", "D2", "D2", "F2", "A#1", "C2", "D2", None, None, None]
LOW_FLOOR_ORIG = [t - 18 for t in target[:17]] + [None, None, None]
_sos_low = ss.butter(4, [40, 220], "band", fs=SR, output="sos")


def _floor(x):                   # Мінімальний RMS у вікні 50ms (лише тривала частина, без атаки барабана)
    w = 2400
    return min(20 * np.log10(np.sqrt(np.mean(x[k:k + w] ** 2)) + 1e-12) for k in range(0, max(1, len(x) - w), 1200))


_kl, _kr = kweight(L), kweight(R)
_low = ss.sosfilt(_sos_low, (L + R) / 2)
for i in range(len(target)):
    if BED_ROOT[i] is None:
        continue
    s0, s1 = idx[i], idx[i + 1]
    want = seg_loud(_kl, _kr, s0, s1) + (LOW_FLOOR_ORIG[i] - target[i])
    have = _floor(_low[s0 + 1200:s1])
    if want - have < 1.5:
        continue
    n = s1 - s0 + int(0.04 * SR); f = hz(BED_ROOT[i])
    tri = additive(f, [1, 0, 1 / 9, 0, 1 / 25], n / SR) + 0.35 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    tri = lp(tri, 250)
    env = np.ones(n); fd = int(0.02 * SR); env[:fd] = np.linspace(0, 1, fd); env[-fd:] = np.linspace(1, 0, fd)
    z = tri * env; zl = ss.sosfilt(_sos_low, z)
    amp = np.sqrt(max(10 ** (want / 10) - 10 ** (have / 10), 0)) / (np.sqrt(np.mean(zl[fd:-fd] ** 2)) + 1e-12)
    e = min(N, s0 + n)
    L[s0:e] += z[: e - s0] * amp * 0.707; R[s0:e] += z[: e - s0] * amp * 0.707

# Динамічний EQ середніх/високих частот (2–6kHz): доводимо відносний рівень 2–6kHz кожної частини до цілі (максимум +12dB). За наявності еталона внесіть його значення; тут усюди на 15dB нижче гучності частини.
MID_ORIG = [t - 15 for t in target]
_sos_mid = ss.butter(2, [2000, 6000], "band", fs=SR, output="sos")
_kl, _kr = kweight(L), kweight(R)
_midL, _midR = ss.sosfiltfilt(_sos_mid, L), ss.sosfiltfilt(_sos_mid, R)
_g = np.zeros(N)
for i in range(len(target)):
    s0, s1 = idx[i], idx[i + 1]
    want = seg_loud(_kl, _kr, s0, s1) + (MID_ORIG[i] - target[i])
    have = 20 * np.log10(np.sqrt(np.mean(((_midL + _midR) / 2)[s0:s1] ** 2)) + 1e-12)
    _g[s0:s1] = 10 ** (np.clip(want - have, 0, 12) / 20) - 1
_g = np.convolve(_g, np.ones(960) / 960, mode="same")
L = L + _g * _midL; R = R + _g * _midR

# «Повітря» >6kHz (вищі обертони + шумові частинки): додаємо шар шуму з фільтром високих частот за відносним рівнем до гучності частини. У прикладі всюди на 24dB нижче.
HF_ORIG = [t - 24 for t in target]
_sos_hf = ss.butter(4, 6000, "high", fs=SR, output="sos")
_kl, _kr = kweight(L), kweight(R)
_hf = ss.sosfilt(_sos_hf, (L + R) / 2)
for i in range(len(target)):
    s0, s1 = idx[i], idx[i + 1]
    want = seg_loud(_kl, _kr, s0, s1) + (HF_ORIG[i] - target[i])
    have = 20 * np.log10(np.sqrt(np.mean(_hf[s0:s1] ** 2)) + 1e-12)
    if want - have > 2:
        need = np.sqrt(max(10 ** (want / 10) - 10 ** (have / 10), 0))
        fade = int(0.01 * SR); n = s1 - s0
        env = np.ones(n); env[:fade] = np.linspace(0, 1, fade); env[-fade:] = np.linspace(1, 0, fade)
        for ch, seed in ((L, 11 + i), (R, 41 + i)):
            z = ss.sosfilt(_sos_hf, np.random.default_rng(seed).standard_normal(n + 2000))[2000:]
            ch[s0:s1] += z / np.sqrt(np.mean(z ** 2)) * need * env

gain_db = np.zeros(len(target))
for _ in range(4):               # Ітерації: хвости звуку перетинають межі частин і впливають один на одного.
    g = np.zeros(N)
    for i in range(len(target)):
        g[idx[i]:idx[i + 1]] = gain_db[i]
    g = np.convolve(g, np.ones(480) / 480, mode="same")      # Згладжування 10ms, щоб уникнути ступінчастих звукових артефактів
    gl, gr = L * 10 ** (g / 20), R * 10 ** (g / 20)
    kl, kr = kweight(gl), kweight(gr)
    for i in range(len(target)):
        gain_db[i] += target[i] - seg_loud(kl, kr, idx[i], idx[i + 1])
L, R = gl, gr
print("逐段增益(dB):", np.round(gain_db, 1))


def true_peak(l, r):
    return 20 * np.log10(max(np.abs(ss.resample_poly(l, 4, 1)).max(), np.abs(ss.resample_poly(r, 4, 1)).max()))


def soft_limit(x, ceil):         # Стискаємо лише транзієнти понад поріг (пікова огинаюча з випередженням 1ms).
    from scipy.ndimage import maximum_filter1d
    env = maximum_filter1d(np.abs(x), 96)
    gr = np.minimum(1, ceil / np.maximum(env, 1e-9))
    gr = np.convolve(gr, np.ones(96) / 96, mode="same")
    return x * gr


# Імітація зрізу 16kHz потокового AAC (для збігу фактури з еталонним роликом; якщо не потрібно, можна прибрати).
_sos16 = ss.butter(10, 15800, "low", fs=SR, output="sos")
L, R = ss.sosfiltfilt(_sos16, L), ss.sosfiltfilt(_sos16, R)

TARGET_LUFS, TARGET_TP = -14.0, -1.5
for _ in range(3):
    cur = lufs(L, R); k = 10 ** ((TARGET_LUFS - cur) / 20); L *= k; R *= k
    ceil = 10 ** ((TARGET_TP - 0.05) / 20)
    L, R = soft_limit(L, ceil), soft_limit(R, ceil)

y = np.stack([L, R], 1)
sf.write(OUT, y, SR, subtype="PCM_24")
print(f"写出 {OUT.name}: {len(y)} 样本 = {len(y) / SR:.4f}s, 积分响度 {lufs(L, R):.2f} LUFS, 真峰 {true_peak(L, R):.2f} dBTP")
