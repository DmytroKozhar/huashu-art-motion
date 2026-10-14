# Стан українського перекладу

[Український README](README.uk.md) · [Основний посібник](SKILL.uk.md)

Дата перевірки: 2026-10-14. Базова версія: `64cb27271ee0ad3375298e2890b33cbec36d4051`.

## Що готово

- Український README з поясненням архітектури, передумов, рендеру та обмежень.
- Переклад усіх 15 основних розділів SKILL.
- Повні українські версії п’яти додаткових посібників: [підтримка](CONTRIBUTING.uk.md), [медіаможливості](references/capabilities.uk.md), [зображення](references/images.uk.md), [сумісність](references/compatibility.uk.md), [авторські вимоги до сцен](scripts/engine/时代作者规范.uk.md).
- Українські пояснення для 1 101 початкового китайськомовного коментаря у 45 файлах: 241 Python, 856 у файлах JavaScript, 2 JavaScript усередині HTML і 2 HTML. З них 1 096 коментарів перекладено на місці; 5 ліцензійних/правових приміток у fonts.js та toon.js збережено дослівно, а поруч додано українське пояснення.
- Перекладені всі китайськомовні коментарі Python та всі такі коментарі у п’яти головних JS-файлах рушія і 19 файлах його бібліотек. Китайські назви реальних файлів, вхідні слова й приклади числівників навмисно збережено там, де вони потрібні для розуміння коду.

## Що залишається в оригіналі

Це завершений пріоритетний пакет, а не повна локалізація репозиторію. Початкова статична інвентаризація містила 5 145 коментарів із китайськими ієрогліфами (241 Python, 4 902 JavaScript разом із вбудованими скриптами та 2 HTML). Ще 4 044 коментарі в JavaScript сцен, параметризованих фрагментів, демонстрацій і референсних фільмів не перекладено.

Більшість методичних статей, карток стилів, демонстраційних текстів і журнал змін також залишаються в оригіналі. Збережено всі 67 китайськомовних Python docstring: це рядки програми, які можуть використовуватися як довідка CLI. Ідентифікатори, JSON-ключі, назви файлів, runtime-повідомлення, текст у прикладах, вхідні дані та схеми не локалізовано. П’ять перекладених посібників зберігають усі 16 блоків команд/коду дослівно; українські пояснення наведено поруч.

## Що перевірено

- Усі 440 файлів вихідного архіву побайтово відповідають Git blob SHA базового дерева. Усі початкові медіафайли, шрифти та ліцензії збережено.
- Для 19 змінених Python-файлів збігаються AST, усі токени поза коментарями та весь текст поза межами коментарів.
- Для 24 змінених JavaScript-файлів Acorn підтвердив однакові AST та точні тексти всіх виконуваних токенів. У 22 файлах також дослівно збігаються байти поза коментарями. У fonts.js і toon.js додано лише переноси рядків для українських пояснень поруч із незміненими ліцензійними примітками; решта відмінностей — лише коментарі.
- У двох HTML-файлах змінено лише коментарі, зокрема два коментарі вбудованого JavaScript у index.html; розмітка й виконувані токени збережені.
- Відносні посилання на файли в усіх українських документах ведуть до наявних файлів. У README виправлено підрахунок бібліотек: у базовому дереві 19 файлів `lib/*.js`.
- `release-manifest.json` оновлено за SHA-256 остаточних файлів, включно з новими перекладами. Незмінені файли перевірено за вихідним архівом і Git-деревом.

Код проєкту, його тести й рендеринг не запускалися; залежності не встановлювалися; зовнішні генератори й платні служби не використовувалися. Це статична перевірка перекладу, а не сертифікація працездатності. Наведені у перекладі звіту сумісності тести — історичні результати автора вихідного проєкту, не нові тести цієї гілки.

## Коментарі за файлами

Число означає кількість початкових китайськомовних коментарів, охоплених перекладом або українським поясненням.

| Файл | Коментарів |
|---|---:|
| `scripts/analyze/breakdown.py` | 6 |
| `scripts/audio/synth_艺术史速通.py` | 76 |
| `scripts/capabilities.py` | 9 |
| `scripts/check_release.py` | 1 |
| `scripts/engine/reference_films/spacex/spacex_lin/tools/prep_presenter.py` | 4 |
| `scripts/engine/reference_films/spacex/spacex_wb/assets/make_hand.py` | 4 |
| `scripts/engine/render.py` | 4 |
| `scripts/film_gate.py` | 58 |
| `scripts/font_subset.py` | 3 |
| `scripts/images.py` | 1 |
| `scripts/key_green.py` | 2 |
| `scripts/koubo.py` | 13 |
| `scripts/qa.py` | 18 |
| `scripts/storyboard_lint.py` | 18 |
| `tests/test_clip_theme.py` | 5 |
| `tests/test_clip_world.py` | 1 |
| `tests/test_film_gate.py` | 11 |
| `tests/test_film_gate_blank.py` | 1 |
| `tests/test_storyboard_lint.py` | 6 |
| `scripts/engine/clip.js` | 28 |
| `scripts/engine/engine.js` | 41 |
| `scripts/engine/eras.js` | 4 |
| `scripts/engine/eras_gallery.js` | 6 |
| `scripts/engine/lib/brush.js` | 39 |
| `scripts/engine/lib/camera.js` | 41 |
| `scripts/engine/lib/chart.js` | 24 |
| `scripts/engine/lib/collage.js` | 21 |
| `scripts/engine/lib/diagram.js` | 48 |
| `scripts/engine/lib/fonts.js` | 9 |
| `scripts/engine/lib/kit.js` | 16 |
| `scripts/engine/lib/media.js` | 24 |
| `scripts/engine/lib/motion.js` | 46 |
| `scripts/engine/lib/paint.js` | 39 |
| `scripts/engine/lib/palettes.js` | 17 |
| `scripts/engine/lib/post.js` | 26 |
| `scripts/engine/lib/render.js` | 48 |
| `scripts/engine/lib/rig.js` | 70 |
| `scripts/engine/lib/rig_huashu.js` | 34 |
| `scripts/engine/lib/toon.js` | 44 |
| `scripts/engine/lib/typo.js` | 26 |
| `scripts/engine/lib/ui.js` | 31 |
| `scripts/engine/lib/util.js` | 21 |
| `scripts/engine/transitions.js` | 153 |
| `scripts/engine/index.html` | 3 |
| `scripts/engine/clip.html` | 1 |
