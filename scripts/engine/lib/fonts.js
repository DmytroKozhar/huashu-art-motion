// Кожен файл шрифту реєструється як окрема family (назва файлу без розширення). Приклад: ctx.font = '96px "Cinzel-700"'.
window.FONT_FACES = [
  {family:'Cinzel-400', url:'lib/fonts/Cinzel-400.woff'},
  {family:'Cinzel-700', url:'lib/fonts/Cinzel-700.woff'},
  {family:'CormorantGaramond-500i', url:'lib/fonts/CormorantGaramond-500i.woff'},
  {family:'CormorantGaramond-500', url:'lib/fonts/CormorantGaramond-500.woff'},
  {family:'CormorantGaramond-700', url:'lib/fonts/CormorantGaramond-700.woff'},
  {family:'EBGaramond-400i', url:'lib/fonts/EBGaramond-400i.woff'},
  {family:'EBGaramond-400', url:'lib/fonts/EBGaramond-400.woff'},
  {family:'EBGaramond-600', url:'lib/fonts/EBGaramond-600.woff'},
  {family:'IMFellEnglish-400i', url:'lib/fonts/IMFellEnglish-400i.woff'},
  {family:'IMFellEnglish-400', url:'lib/fonts/IMFellEnglish-400.woff'},
  {family:'PlayfairDisplay-400i', url:'lib/fonts/PlayfairDisplay-400i.woff'},
  {family:'PlayfairDisplay-700i', url:'lib/fonts/PlayfairDisplay-700i.woff'},
  {family:'PlayfairDisplay-700', url:'lib/fonts/PlayfairDisplay-700.woff'},
  {family:'PressStart2P-400', url:'lib/fonts/PressStart2P-400.woff'},
  {family:'Poppins-600', url:'lib/fonts/Poppins-600.woff'},
  {family:'Poppins-700', url:'lib/fonts/Poppins-700.woff'},
  {family:'Poppins-800', url:'lib/fonts/Poppins-800.woff'},
  {family:'JosefinSans-700', url:'lib/fonts/JosefinSans-700.woff'},
  {family:'Bangers-400', url:'lib/fonts/Bangers-400.woff'},
  {family:'GochiHand-400', url:'lib/fonts/GochiHand-400.woff'},
  {family:'Caveat-600', url:'lib/fonts/Caveat-600.woff'},
  {family:'LilitaOne-400', url:'lib/fonts/LilitaOne-400.woff'},
  {family:'NotoSerifJP-600', url:'lib/fonts/NotoSerifJP-600.woff'},
  {family:'Exo2-800i', url:'lib/fonts/Exo2-800i.woff'},
  {family:'ArchivoBlack-400', url:'lib/fonts/ArchivoBlack-400.woff'},
  {family:'Kalam-700', url:'lib/fonts/Kalam-700.woff'},
  {family:'UnifrakturMaguntia-400', url:'lib/fonts/UnifrakturMaguntia-400.woff'},
  {family:'Marcellus-400', url:'lib/fonts/Marcellus-400.woff'},
  {family:'Righteous-400', url:'lib/fonts/Righteous-400.woff'},
  {family:'Anton-400', url:'lib/fonts/Anton-400.woff'},
  {family:'AlfaSlabOne-400', url:'lib/fonts/AlfaSlabOne-400.woff'},
  {family:'Rye-400', url:'lib/fonts/Rye-400.woff'},
  {family:'LibreBaskerville-400', url:'lib/fonts/LibreBaskerville-400.woff'},
  {family:'LibreBaskerville-700', url:'lib/fonts/LibreBaskerville-700.woff'},
  // 中文：霞鹜文楷 Medium 子集（OFL 1.1）。GB2312 全部汉字＋预置字＋skill 里用到的字（font_subset.py --gb2312），生僻字用 scripts/font_subset.py --text 补；NotoSerifJP 是日文子集，简体字不全（「戏」「蓝」都没有）
  // Українське пояснення: Китайська: підмножина LXGW WenKai Medium (OFL 1.1), що містить усі ієрогліфи GB2312, попередньо задані знаки й знаки зі skill (font_subset.py --gb2312). Рідкісні знаки додавайте через scripts/font_subset.py --text. NotoSerifJP — японська підмножина з неповним набором спрощених китайських знаків, зокрема без «戏» і «蓝».
  {family:'LXGWWenKai-500', url:'lib/fonts/LXGWWenKai-500.woff'},
  // ---- Анімаційна мова пояснювальних YouTube-відео (references/09) ----
  // 中文黑体：family 名沿用 PuHui-*（代码里 97 处引用不用改），开源版文件是思源黑体 Noto Sans SC（OFL 1.1）500/700/800/900 四个字重的 GB2312 子集
  // Українське пояснення: Китайський гротеск: назви family PuHui-* збережено, щоб не змінювати 97 посилань у коді. У відкритій версії використано GB2312-підмножини Noto Sans SC (OFL 1.1) чотирьох насиченостей: 500/700/800/900.
  // （scripts/font_subset.py --gb2312，单字重约 1.4MB）。作者原用阿里巴巴普惠体 3.0，其许可不允许转换、拆分后再分发，所以不随仓库附带；
  // Українське пояснення: Підмножини створені через scripts/font_subset.py --gb2312, приблизно 1.4MB на насиченість. Автор спочатку використовував Alibaba PuHui 3.0; його ліцензія не дозволяє подальше розповсюдження після перетворення чи поділу, тому цей шрифт не додається до репозиторію.
  // Якщо PuHui встановлено у вас і ви хочете повернути його, створіть PuHui-*.woff за інструкцією font_subset.py і змініть url у наступних чотирьох рядках.
  {family:'PuHui-Medium', url:'lib/fonts/NotoSansSC-500.woff'},
  {family:'PuHui-Bold', url:'lib/fonts/NotoSansSC-700.woff'},
  {family:'PuHui-Heavy', url:'lib/fonts/NotoSansSC-800.woff'},
  {family:'PuHui-Black', url:'lib/fonts/NotoSansSC-900.woff'},
  // Формули 3b1b: прямий/курсивний CMU (LaTeX Computer Modern).
  {family:'CMU-rm', url:'lib/fonts/cmunrm.woff'},
  {family:'CMU-it', url:'lib/fonts/cmunti.woff'},
  // Для презентацій — Inter, відкритий шрифт, найближчий до SF Pro; для фінансової графіки — Roboto Condensed. Змінна насиченість, вибір через '600 220px "Inter"'.
  {family:'Inter', url:'lib/fonts/Inter-var.woff', desc:{weight:'100 900'}},
  {family:'RobotoCondensed', url:'lib/fonts/RobotoCondensed-var.woff', desc:{weight:'100 900'}},
  // Noto Sans/Serif CJK зі змінною насиченістю: лише знаки з трьох демонстрацій — 3b1b, презентація й фінанси. Вихідні файли не включені; якщо для нової теми бракує знаків, використовуйте PuHui-* або завантажте NotoSansSC[wght].ttf з Google Fonts і перегенеруйте підмножину.
  {family:'NotoSansSC', url:'lib/fonts/NotoSansSC-sub.woff', desc:{weight:'100 900'}},
  {family:'NotoSerifSC', url:'lib/fonts/NotoSerifSC-sub.woff', desc:{weight:'200 900'}},
];
