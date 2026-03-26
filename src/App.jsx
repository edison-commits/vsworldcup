import { useState, useEffect, useCallback, useRef } from "react";
import { API_ENDPOINTS } from "./lib/api";
import {
  clearActiveGame,
  dismissOnboarding,
  isOnboardingDismissed,
  loadActiveGame,
  saveActiveGame,
  saveLastResult,
} from "./lib/gameState";
import {
  formatNumber,
  getWinRate,
  isValidAudioUrl,
  isValidUrl,
  rateLimit,
  sanitizePrompt,
  shuffleArray,
} from "./lib/utils";
import { useTournaments } from "./hooks/useTournaments";
import { useRecentPlays } from "./hooks/useRecentPlays";
import HomeView from "./views/HomeView";
import RoundSelector from "./views/RoundSelector";
import OnboardingModal from "./views/OnboardingModal";
import CreateView from "./views/CreateView";
import { QuickMode, QuickResults } from "./views/QuickMode";
import RankingsView from "./views/RankingsView";
import WinnerScreen from "./views/WinnerBundle";
import SafeImage from "./components/SafeImage";

// ============================================================
// TRANSLATIONS
// ============================================================
const LANGUAGES = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "pt", flag: "🇧🇷", label: "Português" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "th", flag: "🇹🇭", label: "ไทย" },
  { code: "vi", flag: "🇻🇳", label: "Tiếng Việt" },
];

const T = {
  en: {
    browse: "Browse", create: "Create", pickYour: "Pick Your", favorite: "Favorite",
    heroSub: "Two choices. One winner. Play bracket tournaments on anything — or create your own.",
    createTournament: "+ Create Tournament", all: "All", entries: "entries", plays: "plays",
    by: "by", chooseBracket: "Choose Your Bracket Size", howMany: "How many contestants should compete?",
    roundOf: "Round of", final: "FINAL", semis: "SEMI-FINALS", match: "Match",
    backToBrowse: "← Back to Browse", back: "← Back", yourChampion: "Your champion has been crowned!",
    playAgain: "Play Again", rematch: "🔀 Rematch", viewRankings: "View Rankings", browseMore: "Browse More", recentlyPlayed: "Recently Played",
    globalRankings: "Global rankings based on", winRate: "win rate",
    createTitle: "Create Tournament", createSub: "Type a topic and let AI build it, or add entries manually. Need a power of 2 (4, 8, 16, 32).",
    tournamentTitle: "Tournament Title", titlePlaceholder: "e.g. Best Pizza Topping",
    category: "Category", entriesLabel: "Entries", entryName: "Entry name",
    imageUrl: "Image URL (optional)", addEntry: "+ Add Entry", createAndPlay: "Create & Play →",
    errTitle: "Give your tournament a title", errMin: "Need at least 4 named entries",
    errPow2: "Need a power of 2 (4, 8, 16, 32). You have {count} — add {add} or remove {remove}.",
    errMaxLen: "Title must be under 100 characters", errBadUrl: "Entry #{idx} has an invalid image URL.",
    errDupe: "Duplicate entry names found.", noCat: "No tournaments in this category yet.",
    language: "Language", aiGenerate: "✨ AI Generate",
    aiPlaceholder: "Describe your tournament... e.g. \"best hip hop albums\"",
    aiGenerating: "AI is building your bracket...", aiBracketSize: "Entries",
    aiError: "AI generation failed. Try again.", orManual: "or add entries manually below",
    shareResult: "Share Result", yourJourney: "Your Journey", hardestChoice: "Hardest Choice",
    sec: "s", avgTime: "avg", ofPlayersAgreed: "of players agreed", soundOn: "🔊", soundOff: "🔇",
    copied: "Copied!", matchHistory: "Match History", beat: "beat",
    yourBracket: "Your Bracket", quarters: "QUARTER-FINALS",
    dailyChallenge: "Daily Challenge", resetsIn: "Resets in", sameBracket: "same bracket for everyone",
    quickMode: "Quick Mode", quickPicks: "Your Quick Picks", quickAgain: "Again", browseAll: "Browse All",
    shareNow: "Shared!", copyResult: "Copy Result",
    continueBracket: "Continue your bracket", pickUpWhere: "pick up where you left off", resume: "Resume",
  },
  es: {
    browse: "Explorar", create: "Crear", pickYour: "Elige Tu", favorite: "Favorito",
    heroSub: "Dos opciones. Un ganador. Juega torneos de cualquier tema — o crea el tuyo.",
    createTournament: "+ Crear Torneo", all: "Todo", entries: "opciones", plays: "jugadas",
    by: "por", chooseBracket: "Tamaño del Bracket", howMany: "¿Cuántos competidores?",
    roundOf: "Ronda de", final: "FINAL", semis: "SEMIFINALES", match: "Partido",
    backToBrowse: "← Volver", back: "← Volver", yourChampion: "¡Tu campeón ha sido coronado!",
    playAgain: "Jugar de Nuevo", rematch: "🔀 Revancha", viewRankings: "Rankings", browseMore: "Explorar Más", recentlyPlayed: "Jugado Recientemente",
    globalRankings: "Rankings globales", winRate: "tasa de victoria",
    createTitle: "Crear Torneo", createSub: "Describe un tema para la IA o agrega opciones manualmente.",
    tournamentTitle: "Título del Torneo", titlePlaceholder: "ej. Mejor Topping",
    category: "Categoría", entriesLabel: "Opciones", entryName: "Nombre",
    imageUrl: "URL imagen (opcional)", addEntry: "+ Agregar", createAndPlay: "Crear y Jugar →",
    errTitle: "Dale un título", errMin: "Necesitas al menos 4 opciones",
    errPow2: "Debe ser potencia de 2. Tienes {count} — agrega {add} o elimina {remove}.",
    errMaxLen: "Máximo 100 caracteres", errBadUrl: "Opción #{idx} URL inválida.",
    errDupe: "Nombres duplicados.", noCat: "No hay torneos en esta categoría.",
    language: "Idioma", aiGenerate: "✨ IA Generar",
    aiPlaceholder: "Describe tu torneo...", aiGenerating: "La IA construye tu bracket...",
    aiBracketSize: "Opciones", aiError: "Error de IA.", orManual: "o agrega manualmente",
    shareResult: "Compartir", yourJourney: "Tu Camino", hardestChoice: "Decisión Más Difícil",
    sec: "s", avgTime: "prom", ofPlayersAgreed: "de jugadores coincidieron", soundOn: "🔊", soundOff: "🔇",
    copied: "¡Copiado!", matchHistory: "Historial", beat: "venció a",
    yourBracket: "Tu Bracket", quarters: "CUARTOS DE FINAL",
  },
  ko: {
    browse: "둘러보기", create: "만들기", pickYour: "골라봐", favorite: "최애",
    heroSub: "두 가지 선택지. 하나의 승자. 이상형 월드컵을 즐기거나 직접 만들어보세요.",
    createTournament: "+ 월드컵 만들기", all: "전체", entries: "항목", plays: "플레이",
    by: "제작", chooseBracket: "강수 선택", howMany: "몇 명이 경쟁?",
    roundOf: "강", final: "결승", semis: "준결승", match: "경기",
    backToBrowse: "← 돌아가기", back: "← 뒤로", yourChampion: "챔피언이 결정되었습니다!",
    playAgain: "다시 하기", rematch: "🔀 리매치", viewRankings: "랭킹", browseMore: "더 보기", recentlyPlayed: "최근 플레이",
    globalRankings: "글로벌 랭킹", winRate: "승률",
    createTitle: "월드컵 만들기", createSub: "주제를 입력하면 AI가 만들거나, 직접 추가하세요.",
    tournamentTitle: "제목", titlePlaceholder: "예: 최고의 피자 토핑",
    category: "카테고리", entriesLabel: "항목", entryName: "이름",
    imageUrl: "이미지 URL", addEntry: "+ 추가", createAndPlay: "만들고 플레이 →",
    errTitle: "제목을 입력하세요", errMin: "최소 4개 필요",
    errPow2: "2의 거듭제곱 필요 (4,8,16,32). 현재 {count}개.",
    errMaxLen: "100자 이내", errBadUrl: "항목 #{idx} URL 오류.", errDupe: "중복 이름.",
    noCat: "이 카테고리에 월드컵이 없습니다.", language: "언어",
    aiGenerate: "✨ AI 생성", aiPlaceholder: "주제를 설명...",
    aiGenerating: "AI가 만드는 중...", aiBracketSize: "항목 수", aiError: "AI 생성 실패.",
    orManual: "또는 수동 추가", shareResult: "결과 공유", yourJourney: "내 여정",
    hardestChoice: "가장 어려운 선택", sec: "초", avgTime: "평균",
    ofPlayersAgreed: "의 플레이어가 동의", soundOn: "🔊", soundOff: "🔇",
    copied: "복사됨!", matchHistory: "경기 기록", beat: "이김",
    yourBracket: "대진표", quarters: "8강",
  },
  ja: {
    browse: "探す", create: "作成", pickYour: "選んで", favorite: "推し",
    heroSub: "二択対決。最後に残るのは一つだけ。",
    createTournament: "+ 作成", all: "全て", entries: "エントリー", plays: "プレイ",
    by: "作成者", chooseBracket: "サイズ選択", howMany: "何人で勝負？",
    roundOf: "回戦", final: "決勝", semis: "準決勝", match: "試合",
    backToBrowse: "← 戻る", back: "← 戻る", yourChampion: "チャンピオン決定！",
    playAgain: "もう一度", rematch: "🔀 リマッチ", viewRankings: "ランキング", browseMore: "もっと見る", recentlyPlayed: "最近プレイ",
    globalRankings: "グローバルランキング", winRate: "勝率",
    createTitle: "トーナメント作成", createSub: "テーマを入力してAIに作らせるか手動で。",
    tournamentTitle: "タイトル", titlePlaceholder: "例：最高のピザトッピング",
    category: "カテゴリー", entriesLabel: "エントリー", entryName: "名前",
    imageUrl: "画像URL", addEntry: "+ 追加", createAndPlay: "作成してプレイ →",
    errTitle: "タイトルを入力", errMin: "最低4つ必要",
    errPow2: "2の累乗が必要。現在{count}個。", errMaxLen: "100文字以内",
    errBadUrl: "#{idx}のURLが無効。", errDupe: "重複名あり。",
    noCat: "この カテゴリーにはまだありません。", language: "言語",
    aiGenerate: "✨ AI生成", aiPlaceholder: "テーマを説明...",
    aiGenerating: "AI作成中...", aiBracketSize: "数", aiError: "AI失敗。",
    orManual: "または手動追加", shareResult: "結果を共有", yourJourney: "あなたの道のり",
    hardestChoice: "最も難しい選択", sec: "秒", avgTime: "平均",
    ofPlayersAgreed: "のプレイヤーが同意", soundOn: "🔊", soundOff: "🔇",
    copied: "コピー！", matchHistory: "試合履歴", beat: "勝ち",
    yourBracket: "トーナメント表", quarters: "準々決勝",
  },
  zh: {
    browse: "浏览", create: "创建", pickYour: "选出你的", favorite: "最爱",
    heroSub: "两个选择，一个赢家。",
    createTournament: "+ 创建", all: "全部", entries: "选项", plays: "次游玩",
    by: "作者", chooseBracket: "选择赛制", howMany: "多少选手？",
    roundOf: "强", final: "决赛", semis: "半决赛", match: "比赛",
    backToBrowse: "← 返回", back: "← 返回", yourChampion: "冠军诞生！",
    playAgain: "再来一次", rematch: "🔀 重赛", viewRankings: "排名", browseMore: "更多", recentlyPlayed: "最近游玩",
    globalRankings: "全球排名", winRate: "胜率",
    createTitle: "创建比赛", createSub: "输入主题让AI生成，或手动添加。",
    tournamentTitle: "标题", titlePlaceholder: "例：最好的披萨配料",
    category: "分类", entriesLabel: "选项", entryName: "名称",
    imageUrl: "图片URL", addEntry: "+ 添加", createAndPlay: "创建并玩 →",
    errTitle: "请输入标题", errMin: "至少4个",
    errPow2: "需要2的幂次。当前{count}个。", errMaxLen: "100字以内",
    errBadUrl: "#{idx}的URL无效。", errDupe: "名称重复。",
    noCat: "该分类暂无比赛。", language: "语言",
    aiGenerate: "✨ AI生成", aiPlaceholder: "描述主题...",
    aiGenerating: "AI正在生成...", aiBracketSize: "数量", aiError: "AI失败。",
    orManual: "或手动添加", shareResult: "分享结果", yourJourney: "你的旅程",
    hardestChoice: "最难选择", sec: "秒", avgTime: "平均",
    ofPlayersAgreed: "的玩家同意", soundOn: "🔊", soundOff: "🔇",
    copied: "已复制！", matchHistory: "比赛记录", beat: "赢了",
    yourBracket: "对阵表", quarters: "四分之一决赛",
  },
  fr: {
    browse: "Parcourir", create: "Créer", pickYour: "Choisis Ton", favorite: "Favori",
    heroSub: "Deux choix. Un gagnant.", createTournament: "+ Créer", all: "Tout", entries: "entrées", plays: "parties",
    by: "par", chooseBracket: "Taille", howMany: "Combien ?",
    roundOf: "Tour de", final: "FINALE", semis: "DEMI-FINALES", match: "Match",
    backToBrowse: "← Retour", back: "← Retour", yourChampion: "Champion couronné !",
    playAgain: "Rejouer", rematch: "🔀 Revanche", viewRankings: "Classement", browseMore: "Voir Plus", recentlyPlayed: "Joué Récemment",
    globalRankings: "Classement global", winRate: "taux de victoire",
    createTitle: "Créer un Tournoi", createSub: "Décris un thème pour l'IA ou ajoute manuellement.",
    tournamentTitle: "Titre", titlePlaceholder: "ex. Meilleure garniture",
    category: "Catégorie", entriesLabel: "Entrées", entryName: "Nom",
    imageUrl: "URL image", addEntry: "+ Ajouter", createAndPlay: "Créer et Jouer →",
    errTitle: "Donne un titre", errMin: "4 entrées minimum",
    errPow2: "Puissance de 2 requise. Tu en as {count}.", errMaxLen: "100 caractères max",
    errBadUrl: "#{idx} URL invalide.", errDupe: "Doublons trouvés.", noCat: "Pas de tournois ici.",
    language: "Langue", aiGenerate: "✨ IA", aiPlaceholder: "Décris ton tournoi...",
    aiGenerating: "L'IA construit...", aiBracketSize: "Entrées", aiError: "Échec IA.",
    orManual: "ou ajoute manuellement", shareResult: "Partager", yourJourney: "Ton Parcours",
    hardestChoice: "Choix le Plus Dur", sec: "s", avgTime: "moy",
    ofPlayersAgreed: "des joueurs d'accord", soundOn: "🔊", soundOff: "🔇",
    copied: "Copié !", matchHistory: "Historique", beat: "a battu",
    yourBracket: "Votre Bracket", quarters: "QUARTS DE FINALE",
  },
  pt: {
    browse: "Explorar", create: "Criar", pickYour: "Escolha", favorite: "Favorito",
    heroSub: "Duas opções. Um vencedor.", createTournament: "+ Criar", all: "Tudo", entries: "opções", plays: "jogadas",
    by: "por", chooseBracket: "Tamanho", howMany: "Quantos?",
    roundOf: "Rodada de", final: "FINAL", semis: "SEMIFINAIS", match: "Partida",
    backToBrowse: "← Voltar", back: "← Voltar", yourChampion: "Campeão coroado!",
    playAgain: "Jogar Novamente", rematch: "🔀 Revanche", viewRankings: "Rankings", browseMore: "Ver Mais", recentlyPlayed: "Jogado Recentemente",
    globalRankings: "Rankings globais", winRate: "taxa de vitória",
    createTitle: "Criar Torneio", createSub: "Digite um tema ou adicione manualmente.",
    tournamentTitle: "Título", titlePlaceholder: "ex. Melhor pizza",
    category: "Categoria", entriesLabel: "Opções", entryName: "Nome",
    imageUrl: "URL imagem", addEntry: "+ Adicionar", createAndPlay: "Criar e Jogar →",
    errTitle: "Dê um título", errMin: "4 opções mínimo",
    errPow2: "Potência de 2 necessária. Você tem {count}.", errMaxLen: "100 caracteres max",
    errBadUrl: "#{idx} URL inválida.", errDupe: "Duplicados.", noCat: "Nenhum torneio aqui.",
    language: "Idioma", aiGenerate: "✨ IA", aiPlaceholder: "Descreva...",
    aiGenerating: "IA construindo...", aiBracketSize: "Opções", aiError: "Falha IA.",
    orManual: "ou adicione manualmente", shareResult: "Compartilhar", yourJourney: "Sua Jornada",
    hardestChoice: "Escolha Mais Difícil", sec: "s", avgTime: "média",
    ofPlayersAgreed: "dos jogadores concordaram", soundOn: "🔊", soundOff: "🔇",
    copied: "Copiado!", matchHistory: "Histórico", beat: "venceu",
    yourBracket: "Seu Chaveamento", quarters: "QUARTAS DE FINAL",
  },
  de: {
    browse: "Durchsuchen", create: "Erstellen", pickYour: "Wähle", favorite: "Favoriten",
    heroSub: "Zwei Optionen. Ein Gewinner.", createTournament: "+ Erstellen", all: "Alle", entries: "Einträge", plays: "Spiele",
    by: "von", chooseBracket: "Größe", howMany: "Wie viele?",
    roundOf: "Runde", final: "FINALE", semis: "HALBFINALE", match: "Spiel",
    backToBrowse: "← Zurück", back: "← Zurück", yourChampion: "Champion gekrönt!",
    playAgain: "Nochmal", rematch: "🔀 Rematch", viewRankings: "Rangliste", browseMore: "Mehr", recentlyPlayed: "Kürzlich Gespielt",
    globalRankings: "Globale Rangliste", winRate: "Siegrate",
    createTitle: "Turnier Erstellen", createSub: "Thema für KI oder manuell hinzufügen.",
    tournamentTitle: "Titel", titlePlaceholder: "z.B. Bester Belag",
    category: "Kategorie", entriesLabel: "Einträge", entryName: "Name",
    imageUrl: "Bild-URL", addEntry: "+ Hinzufügen", createAndPlay: "Erstellen & Spielen →",
    errTitle: "Titel eingeben", errMin: "Mindestens 4",
    errPow2: "Zweierpotenz nötig. Du hast {count}.", errMaxLen: "Max 100 Zeichen",
    errBadUrl: "#{idx} ungültige URL.", errDupe: "Doppelte Namen.", noCat: "Keine Turniere hier.",
    language: "Sprache", aiGenerate: "✨ KI", aiPlaceholder: "Beschreibe...",
    aiGenerating: "KI erstellt...", aiBracketSize: "Einträge", aiError: "KI-Fehler.",
    orManual: "oder manuell", shareResult: "Teilen", yourJourney: "Dein Weg",
    hardestChoice: "Schwerste Wahl", sec: "s", avgTime: "Ø",
    ofPlayersAgreed: "der Spieler stimmten zu", soundOn: "🔊", soundOff: "🔇",
    copied: "Kopiert!", matchHistory: "Verlauf", beat: "schlug",
    yourBracket: "Dein Bracket", quarters: "VIERTELFINALE",
  },
  th: {
    browse: "เลือกดู", create: "สร้าง", pickYour: "เลือก", favorite: "ที่ชอบ",
    heroSub: "สองตัวเลือก หนึ่งผู้ชนะ", createTournament: "+ สร้าง", all: "ทั้งหมด", entries: "รายการ", plays: "ครั้ง",
    by: "โดย", chooseBracket: "ขนาด", howMany: "จำนวน?",
    roundOf: "รอบ", final: "รอบชิง", semis: "รอบรอง", match: "แมตช์",
    backToBrowse: "← กลับ", back: "← กลับ", yourChampion: "แชมป์ของคุณ!",
    playAgain: "เล่นอีก", rematch: "🔀 รีแมตช์", viewRankings: "อันดับ", browseMore: "ดูเพิ่ม", recentlyPlayed: "เล่นล่าสุด",
    globalRankings: "อันดับทั่วโลก", winRate: "อัตราชนะ",
    createTitle: "สร้างทัวร์นาเมนต์", createSub: "พิมพ์หัวข้อให้ AI หรือเพิ่มเอง",
    tournamentTitle: "ชื่อ", titlePlaceholder: "เช่น พิซซ่าที่ดีที่สุด",
    category: "หมวด", entriesLabel: "รายการ", entryName: "ชื่อ",
    imageUrl: "URL ภาพ", addEntry: "+ เพิ่ม", createAndPlay: "สร้างและเล่น →",
    errTitle: "ใส่ชื่อ", errMin: "ต้องมีอย่างน้อย 4",
    errPow2: "ต้องเป็นเลขยกกำลัง 2 มี {count}", errMaxLen: "ไม่เกิน 100 ตัวอักษร",
    errBadUrl: "#{idx} URL ไม่ถูกต้อง", errDupe: "ชื่อซ้ำ", noCat: "ยังไม่มี",
    language: "ภาษา", aiGenerate: "✨ AI", aiPlaceholder: "อธิบายหัวข้อ...",
    aiGenerating: "AI กำลังสร้าง...", aiBracketSize: "รายการ", aiError: "AI ผิดพลาด",
    orManual: "หรือเพิ่มเอง", shareResult: "แชร์", yourJourney: "เส้นทาง",
    hardestChoice: "ตัวเลือกยากสุด", sec: "วิ", avgTime: "เฉลี่ย",
    ofPlayersAgreed: "ผู้เล่นเห็นด้วย", soundOn: "🔊", soundOff: "🔇",
    copied: "คัดลอก!", matchHistory: "ประวัติ", beat: "ชนะ",
    yourBracket: "สายการแข่ง", quarters: "รอบ 8 ทีม",
  },
  vi: {
    browse: "Khám Phá", create: "Tạo", pickYour: "Chọn", favorite: "Yêu Thích",
    heroSub: "Hai lựa chọn. Một người thắng.", createTournament: "+ Tạo", all: "Tất cả", entries: "mục", plays: "lượt",
    by: "bởi", chooseBracket: "Số Lượng", howMany: "Bao nhiêu?",
    roundOf: "Vòng", final: "CHUNG KẾT", semis: "BÁN KẾT", match: "Trận",
    backToBrowse: "← Quay lại", back: "← Quay lại", yourChampion: "Nhà vô địch!",
    playAgain: "Chơi Lại", rematch: "🔀 Đấu Lại", viewRankings: "Xếp Hạng", browseMore: "Thêm", recentlyPlayed: "Chơi Gần Đây",
    globalRankings: "Xếp hạng toàn cầu", winRate: "tỷ lệ thắng",
    createTitle: "Tạo Giải Đấu", createSub: "Nhập chủ đề để AI tạo hoặc thêm thủ công.",
    tournamentTitle: "Tên", titlePlaceholder: "VD: Pizza ngon nhất",
    category: "Danh mục", entriesLabel: "Mục", entryName: "Tên",
    imageUrl: "URL ảnh", addEntry: "+ Thêm", createAndPlay: "Tạo và Chơi →",
    errTitle: "Đặt tên", errMin: "Cần 4 mục",
    errPow2: "Cần lũy thừa 2. Bạn có {count}.", errMaxLen: "Dưới 100 ký tự",
    errBadUrl: "#{idx} URL lỗi.", errDupe: "Trùng tên.", noCat: "Chưa có giải đấu.",
    language: "Ngôn ngữ", aiGenerate: "✨ AI", aiPlaceholder: "Mô tả chủ đề...",
    aiGenerating: "AI đang tạo...", aiBracketSize: "Số mục", aiError: "AI thất bại.",
    orManual: "hoặc thêm thủ công", shareResult: "Chia sẻ", yourJourney: "Hành Trình",
    hardestChoice: "Lựa Chọn Khó Nhất", sec: "giây", avgTime: "TB",
    ofPlayersAgreed: "người chơi đồng ý", soundOn: "🔊", soundOff: "🔇",
    copied: "Đã sao chép!", matchHistory: "Lịch sử", beat: "thắng",
    yourBracket: "Nhánh Đấu", quarters: "TỨ KẾT",
  },
};

// ============================================================
// CATEGORIES
// ============================================================
const CATEGORIES = [
  { id: "food", label: { en: "Food", es: "Comida", ko: "음식", ja: "食べ物", zh: "美食", fr: "Nourriture", pt: "Comida", de: "Essen", th: "อาหาร", vi: "Ẩm Thực" }, emoji: "🍔" },
  { id: "travel", label: { en: "Travel", es: "Viajes", ko: "여행", ja: "旅行", zh: "旅行", fr: "Voyage", pt: "Viagem", de: "Reisen", th: "ท่องเที่ยว", vi: "Du Lịch" }, emoji: "✈️" },
  { id: "celebrities", label: { en: "Celebrities", es: "Famosos", ko: "연예인", ja: "有名人", zh: "名人", fr: "Célébrités", pt: "Celebridades", de: "Prominente", th: "คนดัง", vi: "Người Nổi Tiếng" }, emoji: "⭐" },
  { id: "athletes", label: { en: "Athletes", es: "Deportistas", ko: "운동선수", ja: "アスリート", zh: "运动员", fr: "Athlètes", pt: "Atletas", de: "Sportler", th: "นักกีฬา", vi: "Vận Động Viên" }, emoji: "🏆" },
  { id: "movies", label: { en: "Movies", es: "Películas", ko: "영화", ja: "映画", zh: "电影", fr: "Films", pt: "Filmes", de: "Filme", th: "ภาพยนตร์", vi: "Phim" }, emoji: "🎬" },
  { id: "music", label: { en: "Music", es: "Música", ko: "음악", ja: "音楽", zh: "音乐", fr: "Musique", pt: "Música", de: "Musik", th: "เพลง", vi: "Âm Nhạc" }, emoji: "🎵" },
  { id: "games", label: { en: "Games", es: "Juegos", ko: "게임", ja: "ゲーム", zh: "游戏", fr: "Jeux", pt: "Jogos", de: "Spiele", th: "เกม", vi: "Trò Chơi" }, emoji: "🎮" },
  { id: "animals", label: { en: "Animals", es: "Animales", ko: "동물", ja: "動物", zh: "动物", fr: "Animaux", pt: "Animais", de: "Tiere", th: "สัตว์", vi: "Động Vật" }, emoji: "🐾" },
  { id: "sports", label: { en: "Sports", es: "Deportes", ko: "스포츠", ja: "スポーツ", zh: "体育", fr: "Sports", pt: "Esportes", de: "Sport", th: "กีฬา", vi: "Thể Thao" }, emoji: "⚽" },
  { id: "weapons", label: { en: "Weapons", es: "Armas", ko: "무기", ja: "武器", zh: "武器", fr: "Armes", pt: "Armas", de: "Waffen", th: "อาวุธ", vi: "Vũ Khí" }, emoji: "⚔️" },
  { id: "cars", label: { en: "Cars", es: "Autos", ko: "자동차", ja: "車", zh: "汽车", fr: "Voitures", pt: "Carros", de: "Autos", th: "รถยนต์", vi: "Xe Hơi" }, emoji: "🏎️" },
  { id: "anime", label: { en: "Anime", es: "Anime", ko: "애니메이션", ja: "アニメ", zh: "动漫", fr: "Anime", pt: "Anime", de: "Anime", th: "อนิเมะ", vi: "Anime" }, emoji: "🌸" },
  { id: "fashion", label: { en: "Fashion", es: "Moda", ko: "패션", ja: "ファッション", zh: "时尚", fr: "Mode", pt: "Moda", de: "Mode", th: "แฟชั่น", vi: "Thời Trang" }, emoji: "👗" },
  { id: "drinks", label: { en: "Drinks", es: "Bebidas", ko: "음료", ja: "ドリンク", zh: "饮品", fr: "Boissons", pt: "Bebidas", de: "Getränke", th: "เครื่องดื่ม", vi: "Đồ Uống" }, emoji: "🍹" },
  { id: "custom", label: { en: "Custom", es: "Personalizado", ko: "커스텀", ja: "カスタム", zh: "自定义", fr: "Personnalisé", pt: "Personalizado", de: "Eigene", th: "กำหนดเอง", vi: "Tùy Chỉnh" }, emoji: "✨" },
];

// ============================================================
// SAMPLE DATA
// ============================================================
let _gid = 1;
function makeItems(names, sp) {
  return names.map((name, i) => {
    const fallbackImg = itemGradientImg(name);
    return { id: _gid++, name, img: fallbackImg, fallbackImg, wins: Math.floor(Math.random()*15000)+3000, losses: Math.floor(Math.random()*12000)+2000 };
  });
}
function makeRichItems(entries, sp) {
  return entries.map((e, i) => {
    const fallbackImg = itemGradientImg(e[0]);
    return {
      id: _gid++, name: e[0], snippet: e[1]||"", snippetType: e[2]||"none",
      snippetSource: e[3]||"",
      // Media preview fields (populated when available)
      audioUrl: e[4]||"",         // Spotify/Apple Music 30s preview MP3
      audioStartSec: e[5]||0,     // best part to start from
      videoId: e[6]||"",          // YouTube video ID
      videoStartSec: e[7]||0,     // YouTube start timestamp
      videoDuration: e[8]||8,     // how many seconds to show
      img: fallbackImg,
      fallbackImg,
      wins: Math.floor(Math.random()*15000)+3000,
      losses: Math.floor(Math.random()*12000)+2000,
    };
  });
}

// Generate a gradient placeholder image as data URI
const GRAD_COLORS = [
  ["#ff2d55","#ff6b81"],["#ff9500","#ffcc00"],["#00c9ff","#92fe9d"],
  ["#7928ca","#ff0080"],["#0070f3","#00dfd8"],["#f77062","#fe5196"],
  ["#4776e6","#8e54e9"],["#00b09b","#96c93d"],["#e44d26","#f16529"],
  ["#ee0979","#ff6a00"],["#1a2980","#26d0ce"],["#c31432","#240b36"],
  ["#3a1c71","#d76d77"],["#0f2027","#2c5364"],["#ee9ca7","#ffdde1"],
  ["#614385","#516395"],
];
const IMG_MAP={"adidas":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Adidas_2022_logo.svg/330px-Adidas_2022_logo.svg.png",
"amalfi coast":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Amalfi_Coast_%28Italy%2C_October_2020%29_-_75_%2850558355441%29.jpg/330px-Amalfi_Coast_%28Italy%2C_October_2020%29_-_75_%2850558355441%29.jpg",
"american football":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Larry_Fitzgerald_catches_TD_at_2009_Pro_Bowl.jpg/330px-Larry_Fitzgerald_catches_TD_at_2009_Pro_Bowl.jpg",
"aperol spritz":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Aperol_Spritz_aboard_Viking_Mariella.jpg/330px-Aperol_Spritz_aboard_Viking_Mariella.jpg",
"aston martin db11":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/2018_Aston_Martin_DB11_V8_Automatic_4.0_Front.jpg/330px-2018_Aston_Martin_DB11_V8_Automatic_4.0_Front.jpg",
"audi r8":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2018_Audi_R8_Coupe_V10_plus_Front.jpg/330px-2018_Audi_R8_Coupe_V10_plus_Front.jpg",
"bbq ribs":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Barbecued_meats.jpg/330px-Barbecued_meats.jpg",
"bmw m3":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/BMW_M3_Competition_%28G80%29_IMG_4041.jpg/330px-BMW_M3_Competition_%28G80%29_IMG_4041.jpg",
"balenciaga":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Balenciaga_%2854024638524%29.jpg/330px-Balenciaga_%2854024638524%29.jpg",
"bali":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/TanahLot_2014.JPG/330px-TanahLot_2014.JPG",
"barcelona":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/%CE%A3%CE%B1%CE%B3%CF%81%CE%AC%CE%B4%CE%B1_%CE%A6%CE%B1%CE%BC%CE%AF%CE%BB%CE%B9%CE%B1_2941.jpg/330px-%CE%A3%CE%B1%CE%B3%CF%81%CE%AC%CE%B4%CE%B1_%CE%A6%CE%B1%CE%BC%CE%AF%CE%BB%CE%B9%CE%B1_2941.jpg",
"baseball":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Tommy_Milone_gives_up_a_home_run_to_Mike_Trout_on_May_21%2C_2017.jpg/330px-Tommy_Milone_gives_up_a_home_run_to_Mike_Trout_on_May_21%2C_2017.jpg",
"basketball":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Steph_Curry_%2851915116957%29.jpg/330px-Steph_Curry_%2851915116957%29.jpg",
"beagle":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Beagle_600.jpg/330px-Beagle_600.jpg",
"boxing":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Boxing_Tournament_in_Aid_of_King_George%27s_Fund_For_Sailors_at_the_Royal_Naval_Air_Station%2C_Henstridge%2C_Somerset%2C_July_1945_A29806.jpg/330px-Boxing_Tournament_in_Aid_of_King_George%27s_Fund_For_Sailors_at_the_Royal_Naval_Air_Station%2C_Henstridge%2C_Somerset%2C_July_1945_A29806.jpg",
"bugatti chiron":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Bugatti_Chiron_1.jpg/330px-Bugatti_Chiron_1.jpg",
"bunny":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oryctolagus_cuniculus_Rcdo.jpg/330px-Oryctolagus_cuniculus_Rcdo.jpg",
"burberry":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Burberry_-_Store_%2851396234449%29.jpg/330px-Burberry_-_Store_%2851396234449%29.jpg",
"burger":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/RedDot_Burger.jpg/330px-RedDot_Burger.jpg",
"caipirinha":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Caipirinha_with_lime.jpg/330px-Caipirinha_with_lime.jpg",
"chanel":"https://upload.wikimedia.org/wikipedia/en/thumb/9/92/Chanel_logo_interlocking_cs.svg/330px-Chanel_logo_interlocking_cs.svg.png",
"corgi":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Welsh_Pembroke_Corgi.jpg/330px-Welsh_Pembroke_Corgi.jpg",
"corvette z06":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg/330px-Chevrolet_Corvette_C8_IAA_2021_1X7A0156.jpg",
"cosmopolitan":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Cosmopolitan_%285076906532%29.jpg/330px-Cosmopolitan_%285076906532%29.jpg",
"cricket":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Pollock_to_Hussey.jpg/330px-Pollock_to_Hussey.jpg",
"daiquiri":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Classic_Daiquiri_in_Cocktail_Glass.jpg/330px-Classic_Daiquiri_in_Cocktail_Glass.jpg",
"dim sum":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Dim_Sum_Trang.jpg/330px-Dim_Sum_Trang.jpg",
"dior":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Christian_Dior%2C_30_Avenue_Montaigne%2C_Paris_2016.jpg/330px-Christian_Dior%2C_30_Avenue_Montaigne%2C_Paris_2016.jpg",
"dodge challenger hellcat":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Dodge_Challenger_SRT8_%282015%29_Hirschaid-20220709-RM-120221.jpg/330px-Dodge_Challenger_SRT8_%282015%29_Hirschaid-20220709-RM-120221.jpg",
"dubai":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg/330px-Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg",
"duckling":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Bucephala-albeola-010.jpg/330px-Bucephala-albeola-010.jpg",
"espresso martini":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Bistrot_Bruno_Loubet%2C_Clerkenwell%2C_London_%284574785649%29.jpg/330px-Bistrot_Bruno_Loubet%2C_Clerkenwell%2C_London_%284574785649%29.jpg",
"falafel":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Falafels_2.jpg/330px-Falafels_2.jpg",
"ferrari sf90":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Red_2019_Ferrari_SF90_Stradale_%2848264238897%29_%28cropped%29.jpg/330px-Red_2019_Ferrari_SF90_Stradale_%2848264238897%29_%28cropped%29.jpg",
"ferret":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Ferret_2008.png/330px-Ferret_2008.png",
"fish & chips":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Fish_and_chips_blackpool.jpg/330px-Fish_and_chips_blackpool.jpg",
"football (soccer)":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Football_in_Bloomington%2C_Indiana%2C_1995.jpg/330px-Football_in_Bloomington%2C_Indiana%2C_1995.jpg",
"ford gt":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Ford_GT_2018_and_Ford_GT_1968_at_Legendy_2019_in_Prague_%28cropped%29.jpg/330px-Ford_GT_2018_and_Ford_GT_1968_at_Legendy_2019_in_Prague_%28cropped%29.jpg",
"fried chicken":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Fried-Chicken-Set.jpg/330px-Fried-Chicken-Set.jpg",
"golden retriever":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Golden_Retriever_Dukedestiny01_drvd.jpg/330px-Golden_Retriever_Dukedestiny01_drvd.jpg",
"golf":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Golfer_swing.jpg/330px-Golfer_swing.jpg",
"gucci":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Gucci_NYC_Flagship_%2848064046878%29.jpg/330px-Gucci_NYC_Flagship_%2848064046878%29.jpg",
"hamster":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/European_hamster_%28Cricetus_cricetus%29_Meidling.jpg/330px-European_hamster_%28Cricetus_cricetus%29_Meidling.jpg",
"hawaii":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/City_of_Waikiki_view.jpg/330px-City_of_Waikiki_view.jpg",
"hedgehog":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Igel.JPG/330px-Igel.JPG",
"hermès":"https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Herm%C3%A8s.svg/330px-Herm%C3%A8s.svg.png",
"hot dog":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hot_dog_with_mustard.png/330px-Hot_dog_with_mustard.png",
"husky":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Husky_L.jpg/330px-Husky_L.jpg",
"ice hockey":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Pittsburgh_Penguins%2C_Washington_Capitals%2C_Bryan_Rust_%2833744033514%29.jpg/330px-Pittsburgh_Penguins%2C_Washington_Capitals%2C_Bryan_Rust_%2833744033514%29.jpg",
"iceland":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Gullfoss_from_the_Air_%28cropped%29.jpg/330px-Gullfoss_from_the_Air_%28cropped%29.jpg",
"kyoto":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/330px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg",
"lamborghini aventador":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/2023_Lamborghini_Aventador_Ultimae.jpg/330px-2023_Lamborghini_Aventador_Ultimae.jpg",
"london":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Elizabeth_Tower%2C_June_2022.jpg/330px-Elizabeth_Tower%2C_June_2022.jpg",
"louis vuitton":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Boutique_Louis_Vuitton_au_101_avenue_des_Champs-Elys%C3%A9es_%C3%A0_Paris.JPG/330px-Boutique_Louis_Vuitton_au_101_avenue_des_Champs-Elys%C3%A9es_%C3%A0_Paris.JPG",
"mma / ufc":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/UFC_131_Carwin_vs._JDS.jpg/330px-UFC_131_Carwin_vs._JDS.jpg",
"machu picchu":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Machu_Picchu%2C_2023_%28012%29.jpg/330px-Machu_Picchu%2C_2023_%28012%29.jpg",
"mai tai":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Mai_Tai_at_Trader_Vic%27s_Emeryville.jpg/330px-Mai_Tai_at_Trader_Vic%27s_Emeryville.jpg",
"maine coon":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/M%C3%A2le_Black_Silver_Blotched_Tabby.jpeg/330px-M%C3%A2le_Black_Silver_Blotched_Tabby.jpeg",
"maldives":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/MaldivesBungalows.jpg/500px-MaldivesBungalows.jpg",
"manhattan":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Manhattan_Cocktail2.jpg/330px-Manhattan_Cocktail2.jpg",
"margarita":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/MargaritaReal.jpg/330px-MargaritaReal.jpg",
"mclaren p1":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/McLaren_P1.jpg/330px-McLaren_P1.jpg",
"mercedes amg gt":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Festival_automobile_international_2015_-_Mercedes_AMG_GT_-_003.jpg/330px-Festival_automobile_international_2015_-_Mercedes_AMG_GT_-_003.jpg",
"mojito":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/15-09-26-RalfR-WLC-0072.jpg/330px-15-09-26-RalfR-WLC-0072.jpg",
"moscow mule":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Cocktail_Moscow_Mule_im_Kupferbecher_mit_Minze.jpg/330px-Cocktail_Moscow_Mule_im_Kupferbecher_mit_Minze.jpg",
"nachos":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Nachos-cheese.jpg/330px-Nachos-cheese.jpg",
"negroni":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/C%C3%B3ctel_Negroni_Campari.jpg/330px-C%C3%B3ctel_Negroni_Campari.jpg",
"new balance":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/New_Balance_logo.svg/330px-New_Balance_logo.svg.png",
"new york":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg/330px-View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg",
"nike":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Nike_Campus%2C_Beaverton_-_DPLA_-_ffa63f1bbaf5cd21aeada3d3978db2b0.jpg/330px-Nike_Campus%2C_Beaverton_-_DPLA_-_ffa63f1bbaf5cd21aeada3d3978db2b0.jpg",
"nissan gt-r":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/2009-2010_Nissan_GT-R_%28R35%29_coupe_01.jpg/330px-2009-2010_Nissan_GT-R_%28R35%29_coupe_01.jpg",
"old fashioned":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Whiskey_Old_Fashioned1.jpg/330px-Whiskey_Old_Fashioned1.jpg",
"pad thai":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Phat_Thai_kung_Chang_Khien_street_stall.jpg/330px-Phat_Thai_kung_Chang_Khien_street_stall.jpg",
"pagani huayra":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Pagani%2C_GIMS_2019%2C_Le_Grand-Saconnex_%28GIMS0023%29.jpg/330px-Pagani%2C_GIMS_2019%2C_Le_Grand-Saconnex_%28GIMS0023%29.jpg",
"paloma":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/TequilaPaloma.JPG/330px-TequilaPaloma.JPG",
"paris":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/330px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg",
"parrot":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Rainbow_lorikeet_%28Trichoglossus_moluccanus_moluccanus%29_Sydney.jpg/330px-Rainbow_lorikeet_%28Trichoglossus_moluccanus_moluccanus%29_Sydney.jpg",
"pasta":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg/330px-%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg",
"persian cat":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Persialainen.jpg/330px-Persialainen.jpg",
"pho":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Ph%E1%BB%9F_b%C3%B2_%2839425047901%29.jpg/330px-Ph%E1%BB%9F_b%C3%B2_%2839425047901%29.jpg",
"pizza":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Pizza-3007395.jpg/330px-Pizza-3007395.jpg",
"piña colada":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Pi%C3%B1a_Colada.jpg/330px-Pi%C3%B1a_Colada.jpg",
"pomeranian":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Pomeranian.JPG/330px-Pomeranian.JPG",
"porsche 911 gt3":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Porsche_992_GT3_1X7A0323.jpg/330px-Porsche_992_GT3_1X7A0323.jpg",
"prada":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Prada_milano.JPG/330px-Prada_milano.JPG",
"ralph lauren":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Gertrude_Rhinelander_Waldo_House_%2851660337406%29.jpg/330px-Gertrude_Rhinelander_Waldo_House_%2851660337406%29.jpg",
"ramen":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Shoyu_ramen%2C_at_Kasukabe_Station_%282014.05.05%29_1.jpg/330px-Shoyu_ramen%2C_at_Kasukabe_Station_%282014.05.05%29_1.jpg",
"rugby":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/2014_Women%27s_Six_Nations_Championship_-_France_Italy_%2851%29.jpg/330px-2014_Women%27s_Six_Nations_Championship_-_France_Italy_%2851%29.jpg",
"safari kenya":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Tanzania-_Serengeti_National_Park-_elefante.jpg/330px-Tanzania-_Serengeti_National_Park-_elefante.jpg",
"santorini":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Santorini_Fira3_tango7174.jpg/330px-Santorini_Fira3_tango7174.jpg",
"shiba inu":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Taka_Shiba.jpg/330px-Taka_Shiba.jpg",
"skateboarding":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/BackSmithGrind.jpg/330px-BackSmithGrind.jpg",
"steak":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Beef_fillet_steak_with_mushrooms.jpg/330px-Beef_fillet_steak_with_mushrooms.jpg",
"supreme":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Supreme_Logo.svg/330px-Supreme_Logo.svg.png",
"sushi":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Sushi_platter.jpg/330px-Sushi_platter.jpg",
"swimming":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Depart4x100.jpg/330px-Depart4x100.jpg",
"swiss alps":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Matterhorn_from_Domh%C3%BCtte_-_2.jpg/330px-Matterhorn_from_Domh%C3%BCtte_-_2.jpg",
"tabby cat":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cat_November_2010-1a.jpg/330px-Cat_November_2010-1a.jpg",
"tacos":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg/330px-001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg",
"tennis":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/2013_Australian_Open_-_Guillaume_Rufin.jpg/330px-2013_Australian_Open_-_Guillaume_Rufin.jpg",
"tesla model s plaid":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Tesla_Model_S_%28Facelift_ab_04-2016%29_%28cropped%29.jpg/330px-Tesla_Model_S_%28Facelift_ab_04-2016%29_%28cropped%29.jpg",
"tokyo":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Tokyo_Tower_2023.jpg/330px-Tokyo_Tower_2023.jpg",
"tom collins":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/VTR_-_Tom_Collins.jpg/330px-VTR_-_Tom_Collins.jpg",
"toyota supra":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Toyota_GR_Supra_%2851984008283crop%29.jpg/330px-Toyota_GR_Supra_%2851984008283crop%29.jpg",
"track & field":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Track_and_field_stadium.jpg/330px-Track_and_field_stadium.jpg",
"turtle":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Turtle_diversity.jpg/330px-Turtle_diversity.jpg",
"versace":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Berlin_-_Kurf%C3%BCrstendamm_193-194.jpg/330px-Berlin_-_Kurf%C3%BCrstendamm_193-194.jpg",
"volleyball":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Brasil_vence_a_Fran%C3%A7a_no_v%C3%B4lei_masculino_1037987-15.08.2016_ffz-6369.jpg/330px-Brasil_vence_a_Fran%C3%A7a_no_v%C3%B4lei_masculino_1037987-15.08.2016_ffz-6369.jpg",
"whiskey sour":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Whiskey_Sour.jpg/330px-Whiskey_Sour.jpg",
"yeezy":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Adidas_Yeezy_Boost_%22Oxford_Tan%22.jpg/330px-Adidas_Yeezy_Boost_%22Oxford_Tan%22.jpg",
"zendaya":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Zendaya_-_2019_by_Glenn_Francis.jpg/330px-Zendaya_-_2019_by_Glenn_Francis.jpg",
"timothée chalamet":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Timoth%C3%A9e_Chalamet-63482_%28cropped%29.jpg/330px-Timoth%C3%A9e_Chalamet-63482_%28cropped%29.jpg",
"margot robbie":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/SYDNEY%2C_AUSTRALIA_-_JANUARY_23_Margot_Robbie_arrives_at_the_Australian_Premiere_of_%27I%2C_Tonya%27_on_January_23%2C_2018_in_Sydney%2C_Australia_%2828074883999%29_%28cropped_2%29.jpg/330px-thumbnail.jpg",
"chris hemsworth":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Chris_Hemsworth_-_Crime_101.jpg/330px-Chris_Hemsworth_-_Crime_101.jpg",
"rihanna":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Rihanna_Fenty_2018.png/330px-Rihanna_Fenty_2018.png",
"ryan gosling":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/GoslingBFI081223_%2822_of_30%29_%2853388157347%29_%28cropped%29.jpg/330px-GoslingBFI081223_%2822_of_30%29_%2853388157347%29_%28cropped%29.jpg",
"sydney sweeney":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_%28cropped%2C_rotated%29.jpg/330px-Sydney_Sweeney_at_the_2024_Toronto_International_Film_Festival_%28cropped%2C_rotated%29.jpg",
"pedro pascal":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Pedro_Pascal_at_the_2025_Cannes_Film_Festival_04.jpg/330px-Pedro_Pascal_at_the_2025_Cannes_Film_Festival_04.jpg",
"jenna ortega":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Jenna_Ortega-63799_%28cropped%29.jpg/330px-Jenna_Ortega-63799_%28cropped%29.jpg",
"jacob elordi":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/JacobElordi-TIFF2025-01_%28cropped_2%29.png/330px-JacobElordi-TIFF2025-01_%28cropped_2%29.png",
"florence pugh":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Florence_Pugh_at_the_2024_Toronto_International_Film_Festival_13_%28cropped_2_%E2%80%93_color_adjusted%29.jpg/330px-Florence_Pugh_at_the_2024_Toronto_International_Film_Festival_13_%28cropped_2_%E2%80%93_color_adjusted%29.jpg",
"oscar isaac":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Oscar_Isaac_at_82nd_Venice_International_Film_Festival-1_%28cropped%29.jpg/330px-Oscar_Isaac_at_82nd_Venice_International_Film_Festival-1_%28cropped%29.jpg",
"ana de armas":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Ana_de_Armas_%2854462619561%29_%28cropped_3%29.jpg/330px-Ana_de_Armas_%2854462619561%29_%28cropped_3%29.jpg",
"dev patel":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Dev_Patel_%2829870651654%29.jpg/330px-Dev_Patel_%2829870651654%29.jpg",
"scarlett johansson":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Scarlett_Johansson-8588.jpg/330px-Scarlett_Johansson-8588.jpg",
"henry cavill":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Henry_Cavill_%2848417913146%29_%28cropped%29.jpg/330px-Henry_Cavill_%2848417913146%29_%28cropped%29.jpg",
"kendrick lamar":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/KendrickSZASPurs230725-144_%28cropped%29_desaturated.jpg/330px-KendrickSZASPurs230725-144_%28cropped%29_desaturated.jpg",
"taylor swift":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png/330px-Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png",
"the beatles":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/The_Beatles_1963_Dezo_Hoffman_Capitol_Records_press_photo_2.jpg/330px-The_Beatles_1963_Dezo_Hoffman_Capitol_Records_press_photo_2.jpg",
"queen":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Queen_A_Night_At_The_Opera_%281975_Elektra_publicity_photo_02%29.jpg/330px-Queen_A_Night_At_The_Opera_%281975_Elektra_publicity_photo_02%29.jpg",
"radiohead":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/RadioheadO2211125_composite.jpg/330px-RadioheadO2211125_composite.jpg",
"beyoncé":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Beyonc%C3%A9_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_%2810_of_118%29_%2852946364598%29_%28best_crop%29.jpg/330px-Beyonc%C3%A9_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_%2810_of_118%29_%2852946364598%29_%28best_crop%29.jpg",
"eminem":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Eminem_2021_Color_Corrected.jpg/330px-Eminem_2021_Color_Corrected.jpg",
"pink floyd":"https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Pink_Floyd_1967_with_Syd_Barrett_%28higher_quality%29.jpg/330px-Pink_Floyd_1967_with_Syd_Barrett_%28higher_quality%29.jpg",
"kanye west":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Kanye_West_at_the_2009_Tribeca_Film_Festival_%28crop_2%29.jpg/330px-Kanye_West_at_the_2009_Tribeca_Film_Festival_%28crop_2%29.jpg",
"drake":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Drake_at_The_Carter_Effect_2017_%2836818935200%29_%28cropped%29.jpg/330px-Drake_at_The_Carter_Effect_2017_%2836818935200%29_%28cropped%29.jpg",
"nirvana":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Nirvana_around_1992.jpg/330px-Nirvana_around_1992.jpg",
"bob marley":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Bob_Marley_1976_press_photo.jpg/330px-Bob_Marley_1976_press_photo.jpg",
"michael jackson":"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Michael_Jackson_1983_%283x4_cropped%29_%28contrast%29.jpg/330px-Michael_Jackson_1983_%283x4_cropped%29_%28contrast%29.jpg",
"billie eilish":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/BillieEilishO2140725-39_-_54665577407_%28cropped%29.jpg/330px-BillieEilishO2140725-39_-_54665577407_%28cropped%29.jpg",
"frank ocean":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Frank_Ocean_2022_Blonded.jpg/330px-Frank_Ocean_2022_Blonded.jpg",
"arctic monkeys":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Arctic_Monkeys_-_Orange_Stage_-_Roskilde_Festival_2014.jpg/330px-Arctic_Monkeys_-_Orange_Stage_-_Roskilde_Festival_2014.jpg",
"michael jordan":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Michael_Jordan_in_2014.jpg/330px-Michael_Jordan_in_2014.jpg",
"serena williams":"https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Serena_Williams_at_the_2025_International_Tennis_Hall_of_Fame_Induction_Ceremony_Press_Conference_%28cropped%29.jpg/330px-Serena_Williams_at_the_2025_International_Tennis_Hall_of_Fame_Induction_Ceremony_Press_Conference_%28cropped%29.jpg",
"lionel messi":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178.jpg/330px-Lionel_Messi_NE_Revolution_Inter_Miami_7.9.25-178.jpg",
"usain bolt":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Usain_Bolt_-_240422_190142_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Usain_Bolt_-_240422_190142_%28cropped%29.jpg",
"muhammad ali":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Muhammad_Ali_NYWTS.jpg/330px-Muhammad_Ali_NYWTS.jpg",
"michael phelps":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Michael_Phelps_Rio_Olympics_2016.jpg/330px-Michael_Phelps_Rio_Olympics_2016.jpg",
"wayne gretzky":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Andrew_Scheer_with_Wayne_Gretzky_%2848055697168%29_%28cropped%29.jpg/330px-Andrew_Scheer_with_Wayne_Gretzky_%2848055697168%29_%28cropped%29.jpg",
"tom brady":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Tom_Brady_-_240422_191334_%28cropped%29_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Tom_Brady_-_240422_191334_%28cropped%29_%28cropped%29.jpg",
"simone biles":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Simone_Biles_National_Team_2024.jpg/330px-Simone_Biles_National_Team_2024.jpg",
"roger federer":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Roger_Federer_2015_%28cropped%29.jpg/330px-Roger_Federer_2015_%28cropped%29.jpg",
"lebron james":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/330px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg",
"tiger woods":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/President_Donald_Trump_hosts_a_reception_honoring_Black_History_Month_%2854341713089%29_%28cropped%29.jpg/330px-President_Donald_Trump_hosts_a_reception_honoring_Black_History_Month_%2854341713089%29_%28cropped%29.jpg",
"babe ruth":"https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Babe_Ruth2.jpg/330px-Babe_Ruth2.jpg",
"pelé":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Pele_con_brasil_%28cropped%29.jpg/330px-Pele_con_brasil_%28cropped%29.jpg",
"michael schumacher":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Michael_Schumacher_china_2012_rotated.png/330px-Michael_Schumacher_china_2012_rotated.png",
"cristiano ronaldo":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Cristiano_Ronaldo_2275_%28cropped%29.jpg/330px-Cristiano_Ronaldo_2275_%28cropped%29.jpg",
"mike tyson":"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Mike_Tyson_Photo_Op_GalaxyCon_Austin_2023.jpg/330px-Mike_Tyson_Photo_Op_GalaxyCon_Austin_2023.jpg",
"kobe bryant":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Kobe_Bryant_Dec_2014.jpg/330px-Kobe_Bryant_Dec_2014.jpg","attack on titan":"https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Attack_on_Titan_manga_volume_1.jpg/220px-Attack_on_Titan_manga_volume_1.jpg",
"blade runner 2049":"https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Blade_Runner_2049_poster.png/220px-Blade_Runner_2049_poster.png",
"chainsaw man":"https://upload.wikimedia.org/wikipedia/en/thumb/9/92/Chainsaw_Man_volume_1.png/220px-Chainsaw_Man_volume_1.png",
"code geass":"https://upload.wikimedia.org/wikipedia/en/thumb/4/43/Code_geass_r1_boxart.jpg/220px-Code_geass_r1_boxart.jpg",
"cowboy bebop":"https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Cowboybebop.jpg/220px-Cowboybebop.jpg",
"dark souls":"https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/Dark_Souls_Cover_Art.jpg/220px-Dark_Souls_Cover_Art.jpg",
"death note":"https://upload.wikimedia.org/wikipedia/en/thumb/5/5d/Death_note_vol_1.jpg/220px-Death_note_vol_1.jpg",
"demon slayer":"https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/Kimetsu_no_Yaiba_manga_volume_1_cover.jpg/220px-Kimetsu_no_Yaiba_manga_volume_1_cover.jpg",
"dragon ball z":"https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Dragon_Ball_Z_Logo.png/220px-Dragon_Ball_Z_Logo.png",
"elden ring":"https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Elden_Ring_Box_art.jpg/220px-Elden_Ring_Box_art.jpg",
"excalibur":"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Arthur-Pyle_Excalibur_the_Sword.JPG/330px-Arthur-Pyle_Excalibur_the_Sword.JPG",
"f1 racing":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Lewis_Hamilton_2016_Malaysia_2.jpg/330px-Lewis_Hamilton_2016_Malaysia_2.jpg",
"fight club":"https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Fight_Club_poster.jpg/220px-Fight_Club_poster.jpg",
"final fantasy vii":"https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/FFVIIboxart.jpg/220px-FFVIIboxart.jpg",
"fullmetal alchemist":"https://upload.wikimedia.org/wikipedia/en/thumb/2/22/Fullmetal_Alchemist_Vol_1.jpg/220px-Fullmetal_Alchemist_Vol_1.jpg",
"gladiator":"https://upload.wikimedia.org/wikipedia/en/thumb/6/6a/Gladiator_%282000_film_poster%29.png/220px-Gladiator_%282000_film_poster%29.png",
"god of war":"https://upload.wikimedia.org/wikipedia/en/thumb/0/02/God_of_War_4_cover.jpg/220px-God_of_War_4_cover.jpg",
"goodfellas":"https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Goodfellas.jpg/220px-Goodfellas.jpg",
"gta v":"https://upload.wikimedia.org/wikipedia/en/thumb/a/a5/Grand_Theft_Auto_V.png/220px-Grand_Theft_Auto_V.png",
"half-life 2":"https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Half-Life_2_cover.jpg/220px-Half-Life_2_cover.jpg",
"halo":"https://upload.wikimedia.org/wikipedia/en/thumb/3/37/Halo_-_Combat_Evolved_%28XBox_version_-_front%29.jpg/220px-Halo_-_Combat_Evolved_%28XBox_version_-_front%29.jpg",
"hunter x hunter":"https://upload.wikimedia.org/wikipedia/en/thumb/6/66/HunterxHunterVol01.jpg/220px-HunterxHunterVol01.jpg",
"inception":"https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/Inception_%282010%29_theatrical_poster.jpg/220px-Inception_%282010%29_theatrical_poster.jpg",
"interstellar":"https://upload.wikimedia.org/wikipedia/en/thumb/b/bc/Interstellar_film_poster.jpg/220px-Interstellar_film_poster.jpg",
"jujutsu kaisen":"https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Jujutsu_Kaisen_Vol._1_cover.jpg/220px-Jujutsu_Kaisen_Vol._1_cover.jpg",
"master sword":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Legend_of_Zelda_25th_Anniversary.jpg/330px-Legend_of_Zelda_25th_Anniversary.jpg",
"minecraft":"https://upload.wikimedia.org/wikipedia/en/thumb/4/4a/Minecraft_cover.png/220px-Minecraft_cover.png",
"mjolnir":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Claes_Kurck_Sk%C3%A5ne_hammer_-_HST_DIG55488_original.jpg/330px-Claes_Kurck_Sk%C3%A5ne_hammer_-_HST_DIG55488_original.jpg",
"mob psycho 100":"https://upload.wikimedia.org/wikipedia/en/thumb/3/38/Mob_Psycho_100_Volume_1.png/220px-Mob_Psycho_100_Volume_1.png",
"my hero academia":"https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/MyHeroAcademia_vol1.jpg/220px-MyHeroAcademia_vol1.jpg",
"naruto":"https://upload.wikimedia.org/wikipedia/en/thumb/9/97/Naruto_Volume_1.png/220px-Naruto_Volume_1.png",
"neon genesis evangelion":"https://upload.wikimedia.org/wikipedia/en/thumb/3/30/Neon_Genesis_Evangelion_Vol_01.jpg/220px-Neon_Genesis_Evangelion_Vol_01.jpg",
"no country for old men":"https://upload.wikimedia.org/wikipedia/en/thumb/2/23/No_Country_for_Old_Men_poster.jpg/220px-No_Country_for_Old_Men_poster.jpg",
"off-white":"https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Off-White_logo.svg/330px-Off-White_logo.svg.png",
"one piece":"https://upload.wikimedia.org/wikipedia/en/thumb/9/90/One_Piece%2C_Volume_61_Cover_%28Japanese%29.jpg/220px-One_Piece%2C_Volume_61_Cover_%28Japanese%29.jpg",
"parasite":"https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Parasite_%282019%29.png/220px-Parasite_%282019%29.png",
"portal 2":"https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Portal2cover.jpg/220px-Portal2cover.jpg",
"pulp fiction":"https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Pulp_Fiction_%281994%29_poster.jpg/220px-Pulp_Fiction_%281994%29_poster.jpg",
"red dead redemption 2":"https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Red_Dead_Redemption_II.jpg/220px-Red_Dead_Redemption_II.jpg",
"resident evil 4":"https://upload.wikimedia.org/wikipedia/en/thumb/9/93/Resident_Evil_4_GC_cover.jpg/220px-Resident_Evil_4_GC_cover.jpg",
"skyrim":"https://upload.wikimedia.org/wikipedia/en/thumb/1/15/The_Elder_Scrolls_V_Skyrim_cover.png/220px-The_Elder_Scrolls_V_Skyrim_cover.png",
"spirited away":"https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Spirited_Away_Japanese_poster.png/220px-Spirited_Away_Japanese_poster.png",
"steins;gate":"https://upload.wikimedia.org/wikipedia/en/thumb/1/16/Steins%3BGate.jpg/220px-Steins%3BGate.jpg",
"super mario odyssey":"https://upload.wikimedia.org/wikipedia/en/thumb/8/8f/Super_Mario_Odyssey.jpg/220px-Super_Mario_Odyssey.jpg",
"the dark knight":"https://upload.wikimedia.org/wikipedia/en/thumb/8/8a/Dark_Knight.jpg/220px-Dark_Knight.jpg",
"the godfather":"https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/Godfather_ver1.jpg/220px-Godfather_ver1.jpg",
"the last of us":"https://upload.wikimedia.org/wikipedia/en/thumb/4/46/Video_game_cover_-_The_Last_of_Us.jpg/220px-Video_game_cover_-_The_Last_of_Us.jpg",
"the matrix":"https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/The_Matrix_Poster.jpg/220px-The_Matrix_Poster.jpg",
"the shawshank redemption":"https://upload.wikimedia.org/wikipedia/en/thumb/8/81/ShawshankRedemptionMoviePoster.jpg/220px-ShawshankRedemptionMoviePoster.jpg",
"the witcher 3":"https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Witcher_3_cover_art.jpg/220px-Witcher_3_cover_art.jpg",
"there will be blood":"https://upload.wikimedia.org/wikipedia/en/thumb/1/1b/There_will_be_blood_8.jpg/220px-There_will_be_blood_8.jpg",
"whiplash":"https://upload.wikimedia.org/wikipedia/en/thumb/4/40/Whiplash_%282014%29_poster.jpg/220px-Whiplash_%282014%29_poster.jpg",
"wolverine's claws":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Hugh_Jackman_2013.jpg/330px-Hugh_Jackman_2013.jpg",
"zelda: botw":"https://upload.wikimedia.org/wikipedia/en/thumb/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg/220px-The_Legend_of_Zelda_Breath_of_the_Wild.jpg",
};
const EMOJI_MAP={"pizza":"🍕","burger":"🍔","sushi":"🍣","tacos":"🌮","taco":"🌮","fried chicken":"🍗","ramen":"🍜","steak":"🥩","pasta":"🍝","bbq ribs":"🍖","pad thai":"🍜","fish & chips":"🐟","pho":"🍜","nachos":"🧀","dim sum":"🥟","falafel":"🧆","hot dog":"🌭","tokyo":"🗼","paris":"🗼","bali":"🏝️","new york":"🗽","maldives":"🏝️","london":"🇬🇧","barcelona":"🇪🇸","iceland":"🧊","santorini":"🏛️","dubai":"🏙️","kyoto":"⛩️","hawaii":"🌺","swiss alps":"🏔️","amalfi coast":"🌊","machu picchu":"🏔️","safari kenya":"🦁","golden retriever":"🐕","tabby cat":"🐱","corgi":"🐕","husky":"🐺","bunny":"🐰","persian cat":"🐱","pomeranian":"🐶","parrot":"🦜","hamster":"🐹","shiba inu":"🐕","maine coon":"🐱","beagle":"🐶","hedgehog":"🦔","ferret":"🐾","turtle":"🐢","duckling":"🦆","michael jordan":"🏀","serena williams":"🎾","lionel messi":"⚽","usain bolt":"🏃","muhammad ali":"🥊","michael phelps":"🏊","wayne gretzky":"🏒","tom brady":"🏈","simone biles":"🤸","roger federer":"🎾","lebron james":"🏀","tiger woods":"⛳","babe ruth":"⚾","pelé":"⚽","michael schumacher":"🏎️","jack nicklaus":"⛳","scarlett johansson":"⭐","pedro pascal":"⭐","florence pugh":"⭐","zendaya":"⭐","timothée chalamet":"⭐","margot robbie":"⭐","oscar isaac":"⭐","anya taylor-joy":"⭐","chris hemsworth":"⭐","sydney sweeney":"⭐","ryan gosling":"⭐","ana de armas":"⭐","henry cavill":"⭐","jenna ortega":"⭐","idris elba":"⭐","emma stone":"⭐","katana":"⚔️","excalibur":"🗡️","mjolnir":"🔨","lightsaber":"✨","master sword":"🗡️","buster sword":"⚔️","keyblade":"🔑","gundam":"🤖","ferrari":"🏎️","lamborghini":"🏎️","porsche":"🏎️","bmw":"🚗","toyota supra":"🏎️","mustang":"🏎️","corvette":"🏎️","tesla":"⚡","naruto":"🍥","one piece":"🏴‍☠️","dragon ball":"🐉","attack on titan":"⚔️","demon slayer":"🔥","my hero academia":"💪","jujutsu kaisen":"👁️","fullmetal alchemist":"⚗️","death note":"📓","spy x family":"🕵️","hunter x hunter":"🎯","one punch man":"👊","cowboy bebop":"🤠","neon genesis evangelion":"🤖","sword art online":"⚔️","margarita":"🍹","mojito":"🍹","old fashioned":"🥃","martini":"🍸","negroni":"🍹","espresso martini":"☕","piña colada":"🍍","whiskey sour":"🥃","daiquiri":"🍹","manhattan":"🥃","cosmopolitan":"🍸","gin & tonic":"🍸","beer":"🍺","wine":"🍷","champagne":"🍾","tom collins":"🍹","soccer":"⚽","basketball":"🏀","tennis":"🎾","baseball":"⚾","cricket":"🏏","rugby":"🏉","golf":"⛳","boxing":"🥊","swimming":"🏊","track & field":"🏃","football":"🏈","hockey":"🏒","volleyball":"🏐","mma":"🥊","surfing":"🏄","skiing":"⛷️","the simpsons":"📺","spongebob":"🧽","batman":"🦇","pokemon":"⚡","mario":"🍄","zelda":"🗡️","minecraft":"⛏️","fortnite":"🎮","god of war":"⚔️","elden ring":"💍","the witcher":"🐺","cyberpunk":"🤖","gta":"🚗","red dead":"🤠","halo":"🎮","final fantasy":"⚔️",
"the godfather":"🎬","the dark knight":"🦇","pulp fiction":"🔫","inception":"🌀","fight club":"🥊","interstellar":"🚀","parasite":"🎭","the shawshank redemption":"⛓️","goodfellas":"🔫","the matrix":"💊","spirited away":"🏯","gladiator":"⚔️","whiplash":"🥁","no country for old men":"💀","there will be blood":"🛢️","blade runner 2049":"🤖",
"porsche 911 gt3":"🏎️","lamborghini aventador":"🏎️","ferrari sf90":"🏎️","mclaren p1":"🏎️","bmw m3":"🏎️","nissan gt-r":"🏎️","mercedes amg gt":"🏎️","ford gt":"🏎️","aston martin db11":"🏎️","bugatti chiron":"🏎️","corvette z06":"🏎️","audi r8":"🏎️","tesla model s plaid":"⚡","pagani huayra":"🏎️","dodge challenger hellcat":"🏎️",
"nike":"👟","louis vuitton":"👜","gucci":"👜","adidas":"👟","prada":"👜","balenciaga":"👟","chanel":"💎","dior":"💎","supreme":"🧢","off-white":"👕","versace":"🏛️","burberry":"🧣","hermès":"👜","new balance":"👟","yeezy":"👟","ralph lauren":"🐎",
"football (soccer)":"⚽","american football":"🏈","mma / ufc":"🥊","f1 racing":"🏎️","ice hockey":"🏒","skateboarding":"🛹",
"kendrick lamar":"🎤","taylor swift":"🎤","the beatles":"🎸","queen":"👑","radiohead":"🎸","beyoncé":"👑","eminem":"🎤","pink floyd":"🎸","kanye west":"🎤","drake":"🎤","nirvana":"🎸","bob marley":"🎸","michael jackson":"🕺","billie eilish":"🎤","frank ocean":"🎵","arctic monkeys":"🎸",
"zelda: botw":"🗡️","the witcher 3":"🐺","red dead redemption 2":"🤠","gta v":"🚗","dark souls":"💀","the last of us":"🍄","skyrim":"🐉","portal 2":"🔵","half-life 2":"🔫","resident evil 4":"🧟","super mario odyssey":"🍄",
"steins;gate":"⏰","code geass":"♟️","mob psycho 100":"💪","chainsaw man":"🪚",
"cristiano ronaldo":"⚽","mike tyson":"🥊","kobe bryant":"🏀","rihanna":"💎","jacob elordi":"⭐","dev patel":"⭐",
"trident of poseidon":"🔱","wolverine's claws":"🐺","bow of artemis":"🏹","spear of leonidas":"🛡️","gáe bolg":"🔱","blades of chaos":"🔥","zangetsu":"⚔️","soul edge":"⚔️",
"aperol spritz":"🍹","mai tai":"🍹","moscow mule":"🍹","paloma":"🍹","caipirinha":"🍹"};
function itemGradientImg(name) {
  const lname = (name||"").toLowerCase().trim();
  // Check for real image first
  const realImg = IMG_MAP[lname];
  if (realImg) return realImg;
  // Fallback to emoji gradient
  const h = [...(name||"?")].reduce((a,c)=>a+c.charCodeAt(0),0);
  const [c1,c2] = GRAD_COLORS[h % GRAD_COLORS.length];
  const emoji = EMOJI_MAP[lname];
  const display = emoji || (name||"?").trim().charAt(0).toUpperCase();
  const fontSize = emoji ? "150" : "120";
  const yPos = emoji ? "310" : "280";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><text x="200" y="${yPos}" text-anchor="middle" font-size="${fontSize}">${display}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SAMPLE_TOURNAMENTS = [
  { id:"fast-food",title:"Fast Food World Cup",category:"food",author:"FoodLover",plays:24831,items:makeItems(["Pizza","Burger","Sushi","Tacos","Fried Chicken","Ramen","Steak","Pasta","BBQ Ribs","Pad Thai","Fish & Chips","Pho","Nachos","Dim Sum","Falafel","Hot Dog"],"food") },
  { id:"dream-vacation",title:"Dream Vacation Spots",category:"travel",author:"Wanderlust",plays:18442,items:makeItems(["Tokyo","Paris","Bali","New York","Maldives","London","Barcelona","Iceland","Santorini","Dubai","Kyoto","Hawaii","Swiss Alps","Amalfi Coast","Machu Picchu","Safari Kenya"],"travel") },
  { id:"best-pet",title:"Best Pet World Cup",category:"animals",author:"PetPerson",plays:31205,items:makeItems(["Golden Retriever","Tabby Cat","Corgi","Husky","Bunny","Persian Cat","Pomeranian","Parrot","Hamster","Shiba Inu","Maine Coon","Beagle","Hedgehog","Ferret","Turtle","Duckling"],"pet") },
  { id:"goat-athlete",title:"GOAT Athletes",category:"athletes",author:"SportsFan",plays:42100,items:makeRichItems([
    ["Michael Jordan","6 rings, 5 MVPs, 10 scoring titles","stat","NBA"],
    ["Lionel Messi","8 Ballon d'Or wins — the most ever","stat","FIFA"],
    ["Serena Williams","23 Grand Slam singles titles","stat","WTA"],
    ["Muhammad Ali","Three-time heavyweight champ, Olympic gold at 18","stat","Boxing"],
    ["Wayne Gretzky","894 career goals — still untouchable","stat","NHL"],
    ["Usain Bolt","9.58 seconds. The fastest human ever.","stat","Olympics"],
    ["Tom Brady","7 Super Bowl rings across 3 decades","stat","NFL"],
    ["Michael Phelps","23 Olympic golds — most decorated ever","stat","Olympics"],
    ["Pelé","1,279 career goals across all competitions","stat","FIFA"],
    ["LeBron James","All-time NBA scoring leader at 40K+","stat","NBA"],
    ["Tiger Woods","15 majors, dominated golf for a decade","stat","PGA"],
    ["Cristiano Ronaldo","900+ career goals, 5 Champions Leagues","stat","FIFA"],
    ["Simone Biles","Most decorated gymnast in history","stat","Olympics"],
    ["Mike Tyson","Youngest heavyweight champion at age 20","stat","Boxing"],
    ["Kobe Bryant","81 points in a single game. Mamba mentality.","stat","NBA"],
    ["Roger Federer","20 Grand Slams with effortless grace","stat","ATP"],
  ],"athlete") },
  { id:"celeb-crush",title:"Celebrity Crush",category:"celebrities",author:"PopCulture",plays:55200,items:makeItems(["Zendaya","Timothée Chalamet","Margot Robbie","Chris Hemsworth","Rihanna","Ryan Gosling","Sydney Sweeney","Pedro Pascal","Jenna Ortega","Jacob Elordi","Florence Pugh","Oscar Isaac","Ana de Armas","Dev Patel","Scarlett Johansson","Henry Cavill"],"celeb") },
  { id:"legendary-weapons",title:"Legendary Weapons",category:"weapons",author:"HistoryBuff",plays:28900,items:makeRichItems([
    ["Katana","Folded steel forged through centuries of samurai tradition","fact","Japanese"],
    ["Excalibur","The legendary sword embedded in stone by ancient magic","fact","Arthurian Legend"],
    ["Lightsaber","Plasma blade powered by kyber crystals, wielded by Force users","fact","Star Wars"],
    ["Mjolnir","Enchanted Asgardian hammer, weighs as much as a neutron star","fact","Norse/Marvel"],
    ["Trident of Poseidon","Commands seas, summons storms, rules the ocean","fact","Greek Mythology"],
    ["Master Sword","The legendary blade that seals darkness across timelines","fact","Legend of Zelda"],
    ["Buster Sword","6 feet of impossible steel, weighing roughly 80 pounds","stat","Final Fantasy VII"],
    ["Gundam Beam Saber","Superheated plasma contained in a magnetic field","fact","Gundam"],
    ["Wolverine's Claws","Adamantium-coated bone claws with instant regeneration","fact","X-Men"],
    ["Bow of Artemis","Divine bow blessed with goddess-tier accuracy","fact","Greek Mythology"],
    ["Spear of Leonidas","Spartan weapon that held the pass at Thermopylae","fact","Ancient Greece"],
    ["Gáe Bolg","Celtic cursed spear — once thrown, never misses its mark","fact","Celtic Myth"],
    ["Keyblade","Mystical weapon that unlocks passage between worlds","fact","Kingdom Hearts"],
    ["Blades of Chaos","Chained weapons seared into the wielder's forearms","fact","God of War"],
    ["Zangetsu","A zanpakuto that grows stronger with its wielder's resolve","fact","Bleach"],
    ["Soul Edge","Cursed sword that corrupts and consumes anyone who wields it","fact","Soul Calibur"],
  ],"weapon") },
  { id:"dream-cars",title:"Dream Car World Cup",category:"cars",author:"GearHead",plays:37800,items:makeItems(["Porsche 911 GT3","Lamborghini Aventador","Ferrari SF90","McLaren P1","BMW M3","Toyota Supra","Nissan GT-R","Mercedes AMG GT","Ford GT","Aston Martin DB11","Bugatti Chiron","Corvette Z06","Audi R8","Tesla Model S Plaid","Pagani Huayra","Dodge Challenger Hellcat"],"car") },
  { id:"best-anime",title:"Best Anime",category:"anime",author:"Otaku",plays:61200,items:makeRichItems([
    ["Attack on Titan","Humanity fights for survival behind massive walls","fact","2013-2023"],
    ["Death Note","A notebook that kills — the ultimate cat-and-mouse","fact","2006"],
    ["Fullmetal Alchemist","Two brothers pay the price for breaking alchemy's taboo","fact","2003"],
    ["One Piece","The longest treasure hunt in anime: 1100+ episodes","stat","1999-present"],
    ["Naruto","An orphan ninja's journey to becoming village leader","fact","2002"],
    ["Demon Slayer","Breathtaking animation and a brother's quest for a cure","fact","2019"],
    ["Jujutsu Kaisen","Cursed energy battles with the coolest sensei in anime","fact","2020"],
    ["Dragon Ball Z","Power levels, transformations, and planet-destroying fights","fact","1989"],
    ["Hunter x Hunter","The most complex power system in all of shonen","fact","2011"],
    ["Cowboy Bebop","Jazz, bounty hunters, and existential dread in space","fact","1998"],
    ["My Hero Academia","What if everyone had superpowers except you?","fact","2016"],
    ["Steins;Gate","A microwave, time travel, and devastating consequences","fact","2011"],
    ["Code Geass","Chess-level strategy meets mecha rebellion","fact","2006"],
    ["Neon Genesis Evangelion","Giant robots as a metaphor for teenage depression","fact","1995"],
    ["Mob Psycho 100","The most powerful psychic just wants a normal life","fact","2016"],
    ["Chainsaw Man","A guy fused with a chainsaw devil. Yes, really.","fact","2022"],
  ],"anime") },
  { id:"best-movies",title:"Greatest Movies",category:"movies",author:"CinemaLover",plays:48500,items:makeRichItems([
    ["The Godfather","A Sicilian family dynasty built on loyalty and fear","fact","1972"],
    ["The Dark Knight","Chaos vs. order in the best superhero film ever made","fact","2008"],
    ["Pulp Fiction","Nonlinear storytelling that rewired Hollywood","fact","1994"],
    ["Inception","Dreams within dreams — how deep can you go?","fact","2010"],
    ["Fight Club","The movie you weren't supposed to talk about","fact","1999"],
    ["Interstellar","Love transcends time, space, and dimensions","fact","2014"],
    ["Parasite","A masterclass in class warfare and dark comedy","fact","2019"],
    ["The Shawshank Redemption","Hope is a dangerous thing inside prison walls","fact","1994"],
    ["Goodfellas","The rise and fall of a wiseguy, told at breakneck speed","fact","1990"],
    ["The Matrix","What if everything you knew was a simulation?","fact","1999"],
    ["Spirited Away","A girl's journey through a spirit world bathhouse","fact","2001"],
    ["Gladiator","A general turned slave who defied an emperor","fact","2000"],
    ["Whiplash","How far would you go for musical greatness?","fact","2014"],
    ["No Country for Old Men","A relentless hunter and a coin flip that decides fate","fact","2007"],
    ["There Will Be Blood","Oil, greed, and a milkshake metaphor for the ages","fact","2007"],
    ["Blade Runner 2049","What does it mean to be human in a world of replicants?","fact","2017"],
  ],"movie") },
  { id:"cocktails",title:"Best Cocktails",category:"drinks",author:"Mixologist",plays:19300,items:makeItems(["Margarita","Old Fashioned","Mojito","Espresso Martini","Negroni","Whiskey Sour","Piña Colada","Aperol Spritz","Manhattan","Daiquiri","Mai Tai","Moscow Mule","Cosmopolitan","Paloma","Tom Collins","Caipirinha"],"cocktail") },
  { id:"fashion-brands",title:"Fashion Brand Showdown",category:"fashion",author:"StyleGuru",plays:22700,items:makeItems(["Nike","Louis Vuitton","Gucci","Adidas","Prada","Balenciaga","Chanel","Dior","Supreme","Off-White","Versace","Burberry","Hermès","New Balance","Yeezy","Ralph Lauren"],"fashion") },
  { id:"sports-cup",title:"Best Sport to Watch",category:"sports",author:"FanZone",plays:33100,items:makeItems(["Football (Soccer)","Basketball","American Football","Tennis","MMA / UFC","Boxing","F1 Racing","Baseball","Ice Hockey","Cricket","Rugby","Golf","Volleyball","Swimming","Track & Field","Skateboarding"],"sport") },
  { id:"music-artists",title:"Greatest Artists",category:"music",author:"MusicHead",plays:57800,items:makeRichItems([
    ["Kendrick Lamar","Pulitzer Prize-winning rapper from Compton","fact","Hip-Hop"],
    ["Taylor Swift","From country teen to pop's billion-dollar era","fact","Pop/Country"],
    ["The Beatles","Four lads from Liverpool who changed everything","fact","Rock"],
    ["Queen","Stadium-filling anthems and operatic rock fusion","fact","Rock"],
    ["Radiohead","Reinvented rock with electronic experimentation","fact","Alt Rock"],
    ["Beyoncé","32 Grammys — the most decorated artist ever","stat","R&B/Pop"],
    ["Eminem","Detroit's fastest mouth, rap's best-selling solo act","fact","Hip-Hop"],
    ["Pink Floyd","Concept albums that turned rock into art","fact","Prog Rock"],
    ["Kanye West","21 Grammys and the most polarizing ego in music","fact","Hip-Hop"],
    ["Drake","Most streamed artist in Spotify history","stat","Hip-Hop/R&B"],
    ["Nirvana","Three chords that killed hair metal overnight","fact","Grunge"],
    ["Bob Marley","Brought reggae and a message of peace to the world","fact","Reggae"],
    ["Michael Jackson","Thriller sold 70M copies — still the best-selling album","stat","Pop"],
    ["Billie Eilish","Whisper-pop that conquered Gen Z at age 17","fact","Pop"],
    ["Frank Ocean","Redefined R&B with raw vulnerability and visual albums","fact","R&B"],
    ["Arctic Monkeys","Sheffield indie kids who filled stadiums worldwide","fact","Indie Rock"],
  ],"musicart") },
  { id:"best-games",title:"Best Video Games",category:"games",author:"GamerPro",plays:71200,items:makeRichItems([
    ["Zelda: BOTW","An open world that rewards curiosity at every turn","fact","2017"],
    ["Elden Ring","FromSoft + George R.R. Martin = brutal perfection","fact","2022"],
    ["The Witcher 3","200+ hours of monster hunting and moral dilemmas","stat","2015"],
    ["Red Dead Redemption 2","The most emotionally devastating cowboy simulator","fact","2018"],
    ["GTA V","$8 billion in revenue — the best-selling entertainment product ever","stat","2013"],
    ["Minecraft","300M copies sold, infinite procedural worlds","stat","2011"],
    ["Dark Souls","Defined a genre: punishing, fair, and deeply rewarding","fact","2011"],
    ["God of War","A rage-fueled dad learns to be a father","fact","2018"],
    ["The Last of Us","Post-apocalyptic survival that hits like a gut punch","fact","2013"],
    ["Skyrim","Open-world RPG that people are still modding 13 years later","fact","2011"],
    ["Halo","Defined console FPS and launched Xbox into the spotlight","fact","2001"],
    ["Final Fantasy VII","The JRPG that made an entire generation cry","fact","1997"],
    ["Portal 2","Puzzle perfection with the funniest villain in gaming","fact","2011"],
    ["Half-Life 2","Physics-based gameplay that revolutionized PC shooters","fact","2004"],
    ["Resident Evil 4","Reinvented survival horror as over-the-shoulder action","fact","2005"],
    ["Super Mario Odyssey","Pure joy distilled into a hat-throwing platformer","fact","2017"],
  ],"game") },
];

// ============================================================
// SOUND ENGINE (Web Audio API)
// ============================================================
const SFX = {
  _ctx: null,
  _enabled: true,
  getCtx() { if(!this._ctx) this._ctx = new (window.AudioContext||window.webkitAudioContext)(); return this._ctx; },
  play(type) {
    if(!this._enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if(type==="pick") {
        osc.type="sine"; osc.frequency.setValueAtTime(600,ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900,ctx.currentTime+0.08);
        gain.gain.setValueAtTime(0.15,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.15);
      } else if(type==="round") {
        osc.type="triangle"; osc.frequency.setValueAtTime(400,ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800,ctx.currentTime+0.2);
        gain.gain.setValueAtTime(0.12,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3);
      } else if(type==="victory") {
        [523,659,784,1047].forEach((f,i) => {
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type="sine"; o.frequency.setValueAtTime(f,ctx.currentTime+i*0.12);
          g.gain.setValueAtTime(0.15,ctx.currentTime+i*0.12);
          g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.12+0.3);
          o.start(ctx.currentTime+i*0.12); o.stop(ctx.currentTime+i*0.12+0.3);
        });
      }
    } catch(e) {}
  },
  toggle() { this._enabled=!this._enabled; return this._enabled; },
  get enabled() { return this._enabled; },
};

// ============================================================
// AUDIO PREVIEW ENGINE (Spotify/Apple Music/Deezer preview URLs)
// ============================================================
// Manages two HTML5 Audio elements for crossfade between matchups.
// Spotify previews are 30-second MP3s, free via their Web API.
// Usage: AudioEngine.play("https://p.scdn.co/mp3-preview/...", 5)
const AudioEngine = {
  _els: [null, null],
  _active: 0,
  _enabled: true,
  _inited: false,
  _fadeTimers: [null, null],

  init() {
    if (typeof Audio === "undefined") return;
    this._els = [new Audio(), new Audio()];
    this._els.forEach(a => { a.volume = 0.35; a.crossOrigin = "anonymous"; a.preload = "auto"; });
    this._inited = true;
  },

  play(url, startSec) {
    if (!this._enabled || !url || !isValidAudioUrl(url)) return;
    if (!this._inited) this.init();
    if (!this._els[0]) return;
    // Clear any existing fade on old channel
    if (this._fadeTimers[this._active]) clearInterval(this._fadeTimers[this._active]);
    // Fade out current
    const old = this._els[this._active];
    if (old && !old.paused) {
      let vol = old.volume;
      this._fadeTimers[this._active] = setInterval(() => { vol -= 0.05; if (vol <= 0) { old.pause(); old.volume = 0.35; clearInterval(this._fadeTimers[this._active]); } else old.volume = vol; }, 30);
    }
    // Play new on alternate channel
    this._active = 1 - this._active;
    if (this._fadeTimers[this._active]) clearInterval(this._fadeTimers[this._active]);
    const el = this._els[this._active];
    try {
      el.src = url;
      el.currentTime = startSec || 0;
      el.volume = 0;
      const ch = this._active;
      el.play().then(() => {
        let vol = 0;
        this._fadeTimers[ch] = setInterval(() => { vol += 0.05; if (vol >= 0.35) { el.volume = 0.35; clearInterval(this._fadeTimers[ch]); } else el.volume = vol; }, 30);
      }).catch(() => {});
    } catch (e) {}
  },

  stopAll() {
    this._fadeTimers.forEach((t, i) => { if (t) clearInterval(t); this._fadeTimers[i] = null; });
    this._els.forEach(a => { if (a) try { a.pause(); a.currentTime = 0; a.volume = 0.35; } catch(e){} });
  },

  toggle() {
    this._enabled = !this._enabled;
    if (!this._enabled) this.stopAll();
    return this._enabled;
  },
  get enabled() { return this._enabled; },
};



// ============================================================
// AUDIO BARS VISUALIZER (shows when audio is playing)
// ============================================================
function AudioBars({ active }) {
  if (!active) return null;
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, display: "flex", gap: 2,
      alignItems: "flex-end", height: 18, zIndex: 5,
    }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 1, background: "#00e5ff",
          animation: `audioBar 0.${4 + i * 2}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );
}

// ============================================================
// THEMES (dark & light)
// ============================================================
const THEMES = {
  dark: {
    bg:"#0a0a0f",surface:"#12121a",surfaceLight:"#1a1a28",border:"#2a2a3a",
    text:"#e8e8f0",textDim:"#8888a0",accent:"#ff3366",accentGlow:"rgba(255,51,102,0.3)",
    accentAlt:"#00e5ff",accentAltGlow:"rgba(0,229,255,0.2)",gold:"#ffd700",
    silver:"#c0c0c0",bronze:"#cd7f32",success:"#00e676",
    headerBg:"rgba(10,10,15,0.85)",cardShadow:"0 4px 20px rgba(0,0,0,0.3)",
  },
  light: {
    bg:"#f5f5f8",surface:"#ffffff",surfaceLight:"#eeeef2",border:"#d0d0da",
    text:"#1a1a2e",textDim:"#6868a0",accent:"#e02255",accentGlow:"rgba(224,34,85,0.15)",
    accentAlt:"#0099cc",accentAltGlow:"rgba(0,153,204,0.1)",gold:"#d4a800",
    silver:"#909090",bronze:"#b06a20",success:"#00a854",
    headerBg:"rgba(245,245,248,0.9)",cardShadow:"0 2px 12px rgba(0,0,0,0.08)",
  },
};

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap";

// ============================================================
// AI BRACKET GENERATOR
// ============================================================
const CATEGORY_IDS = CATEGORIES.map(c=>c.id);
async function aiGenerateBracket(prompt,count,lang) {
  const safePrompt = sanitizePrompt(prompt);
  if (!safePrompt) throw new Error("Invalid prompt");
  const r = await fetch(API_ENDPOINTS.generate,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({prompt:safePrompt,count}),
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

// ============================================================
// AI GENERATOR COMPONENT
// ============================================================
function AiGenerator({onGenerated,lang}) {
  const t=T[lang]; const[prompt,setPrompt]=useState(""); const[count,setCount]=useState(16);
  const[loading,setLoading]=useState(false); const[error,setError]=useState(""); const[progress,setProgress]=useState(0);
  const pRef=useRef(null); const mRef=useRef(true);
  useEffect(()=>{return()=>{mRef.current=false;if(pRef.current)clearInterval(pRef.current);};},[]);
  const go=async()=>{
    if(!prompt.trim()||loading)return; setLoading(true);setError("");setProgress(0);
    pRef.current=setInterval(()=>setProgress(p=>p>=90?90:p+Math.random()*12),300);
    try{
      const res=await aiGenerateBracket(prompt.trim(),count,lang);
      if(pRef.current)clearInterval(pRef.current); if(!mRef.current)return; setProgress(100);
      if(!res.entries||res.entries.length<4)throw new Error("bad");
      const items=res.entries.slice(0,count).map((e,i)=>{ const fallbackImg=itemGradientImg(e.name||'Item'); return {id:_gid++,name:e.name?.slice(0,60)||`Entry ${i+1}`,tagline:e.tagline||"",snippet:e.tagline||"",snippetType:e.snippetType||"fact",img:fallbackImg,fallbackImg,wins:0,losses:0}; });
      setTimeout(()=>{if(!mRef.current)return;onGenerated({title:res.title?.slice(0,100)||prompt.slice(0,100),category:CATEGORY_IDS.includes(res.category)?res.category:"custom",items});setLoading(false);},400);
    }catch(e){if(pRef.current)clearInterval(pRef.current);if(!mRef.current)return;setError(t.aiError);setLoading(false);setProgress(0);}
  };
  return (
    <div style={{background:"linear-gradient(135deg,rgba(255,51,102,0.06),rgba(0,229,255,0.06))",border:"1px solid rgba(255,51,102,0.15)",borderRadius:20,padding:"28px 24px",marginBottom:32}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <span style={{fontSize:22}}>🤖</span>
        <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:700,margin:0}}>AI Bracket Generator</h3>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder={t.aiPlaceholder} disabled={loading} maxLength={200}
          style={{flex:1,padding:"13px 16px",borderRadius:12,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontFamily:"'Outfit',sans-serif",fontSize:15,outline:"none",opacity:loading?0.5:1}} />
        <button onClick={go} disabled={loading||!prompt.trim()} style={{
          background:loading?"var(--surfaceLight)":"linear-gradient(135deg,var(--accent),#ff6699)",color:"#fff",border:"none",borderRadius:12,padding:"13px 24px",
          fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading||!prompt.trim()?0.5:1,whiteSpace:"nowrap"
        }}>{loading?"...":t.aiGenerate}</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:loading?16:0}}>
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:"var(--textDim)"}}>{t.aiBracketSize}:</span>
        {[4,8,16,32].map(n=>(
          <button key={n} onClick={()=>!loading&&setCount(n)} style={{padding:"5px 14px",borderRadius:16,background:count===n?"var(--accent)":"var(--surfaceLight)",color:count===n?"#fff":"var(--textDim)",border:`1px solid ${count===n?"var(--accent)":"var(--border)"}`,fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>{n}</button>
        ))}
      </div>
      {loading&&(<div><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:18,height:18,border:"2px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:"var(--accentAlt)"}}>{t.aiGenerating}</span></div><div style={{width:"100%",height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,var(--accent),var(--accentAlt))",borderRadius:2,transition:"width 0.3s ease"}}/></div></div>)}
      {error&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:"rgba(255,51,102,0.1)",border:"1px solid var(--accent)",fontFamily:"'Outfit',sans-serif",fontSize:13,color:"var(--accent)"}}>{error}</div>}
    </div>
  );
}

// ============================================================
// LANG PICKER
// ============================================================
function LangPicker({lang,setLang}) {
  const[open,setOpen]=useState(false); const cur=LANGUAGES.find(l=>l.code===lang);
  return (<div style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"var(--surfaceLight)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:"var(--text)",fontFamily:"'Outfit',sans-serif",fontSize:13}}>
      <span style={{fontSize:18}}>{cur.flag}</span><span style={{fontSize:11,color:"var(--textDim)"}}>▼</span>
    </button>
    {open&&<><div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/><div style={{position:"absolute",top:"110%",right:0,zIndex:200,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:6,minWidth:180,boxShadow:"0 12px 40px rgba(0,0,0,0.4)",maxHeight:320,overflowY:"auto"}}>
      {LANGUAGES.map(l=><button key={l.code} onClick={()=>{setLang(l.code);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",border:"none",borderRadius:8,background:lang===l.code?"var(--accentGlow)":"transparent",color:"var(--text)",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:14}}><span style={{fontSize:20}}>{l.flag}</span><span>{l.label}</span></button>)}
    </div></>}
  </div>);
}

// ============================================================
// HEADER
// ============================================================
function Header({currentView,setView,setSelectedTournament,lang,setLang,themeMode,setThemeMode,soundEnabled,toggleSound}) {
  const t=T[lang];
  return (
    <header style={{position:"sticky",top:0,zIndex:100,background:"var(--headerBg)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--border)",padding:"0 24px"}}>
      <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <div onClick={()=>{setView("home");setSelectedTournament(null);}} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28,fontFamily:"'Space Mono',monospace",fontWeight:700,background:"linear-gradient(135deg,var(--accent),var(--accentAlt))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>VS</span>
          <span style={{fontSize:18,fontFamily:"'Outfit',sans-serif",fontWeight:700,color:"var(--text)"}}>WORLDCUP</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <nav style={{display:"flex",gap:4}}>
            {[{id:"home",label:t.browse},{id:"create",label:t.create}].map(tab=>
              <button key={tab.id} onClick={()=>{setView(tab.id);setSelectedTournament(null);}} style={{background:currentView===tab.id?"var(--accent)":"transparent",color:currentView===tab.id?"#fff":"var(--textDim)",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>{tab.label}</button>
            )}
          </nav>
          <button onClick={toggleSound} style={{background:"none",border:"none",fontSize:16,cursor:"pointer",padding:"6px"}}>{soundEnabled?t.soundOn:t.soundOff}</button>
          <button onClick={()=>setThemeMode(themeMode==="dark"?"light":"dark")} style={{background:"var(--surfaceLight)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:14}}>{themeMode==="dark"?"☀️":"🌙"}</button>
          <LangPicker lang={lang} setLang={setLang} />
        </div>
      </div>
    </header>
  );
}

// ============================================================
// GAMEPLAY (with match history, hesitation, spectator stats)
// ============================================================
function GamePlay({tournament,bracketSize,onFinish,onStart,onBack,lang}) {
  const t=T[lang];
  const[matchups,setMatchups]=useState([]); const[ci,setCi]=useState(0);
  const[winners,setWinners]=useState([]); const[round,setRound]=useState(bracketSize);
  const[totalRounds]=useState(Math.log2(bracketSize)); const[crn,setCrn]=useState(1);
  const[selected,setSelected]=useState(null); const[animating,setAnimating]=useState(false);
  const mountedRef=useRef(true); const animRef=useRef(false); const timerRef=useRef(null);
  // Match history tracking
  const[history,setHistory]=useState([]); const pickTimeRef=useRef(Date.now());
  // Spectator stats (simulated)
  const[spectatorPct,setSpectatorPct]=useState(null);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;if(timerRef.current)clearTimeout(timerRef.current);AudioEngine.stopAll();};},[]);

  // Keyboard shortcuts: A/Left = pick left, D/Right = pick right
  useEffect(()=>{
    if(!matchups.length||!matchups[ci]||animating)return;
    const handleKey=(e)=>{
      if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A"){if(!animRef.current)handlePick(left,right);}
      if(e.key==="ArrowRight"||e.key==="d"||e.key==="D"){if(!animRef.current)handlePick(right,left);}
    };
    window.addEventListener("keydown",handleKey);
    return()=>window.removeEventListener("keydown",handleKey);
  },[matchups,ci,left,right,animating,handlePick]);
  useEffect(()=>{
    const sh=shuffleArray(tournament.items).slice(0,bracketSize);
    const pairs=[]; for(let i=0;i<sh.length;i+=2)pairs.push([sh[i],sh[i+1]]);
    setMatchups(pairs); pickTimeRef.current=Date.now();
  },[tournament,bracketSize]);

  useEffect(()=>{
    if(onStart&&tournament){
      onStart({ tournamentId:tournament.id, bracketSize, updatedAt:Date.now() });
    }
  },[onStart,tournament,bracketSize]);

  // Play audio preview when matchup changes
  useEffect(()=>{
    if(!matchups.length||!matchups[ci])return;
    const[l,r]=matchups[ci];
    // Pick whichever side has an audio preview (prefer left)
    const previewItem = l.audioUrl ? l : r.audioUrl ? r : null;
    if(previewItem && AudioEngine.enabled){
      AudioEngine.play(previewItem.audioUrl, previewItem.audioStartSec || 0);
    } else {
      AudioEngine.stopAll();
    }
  },[ci,matchups]);

  const handlePick=useCallback((item,other)=>{
    if(animRef.current)return;
    animRef.current=true; setAnimating(true); setSelected(item.id);
    SFX.play("pick");
    const elapsed=((Date.now()-pickTimeRef.current)/1000);
    const pct=50+Math.floor(Math.random()*30); // simulated agreement
    setSpectatorPct(pct);
    const matchRecord={winner:item,loser:other,round,matchIdx:ci,time:elapsed,spectatorPct:pct};
    timerRef.current=setTimeout(()=>{
      if(!mountedRef.current)return;
      const newH=[...history,matchRecord]; setHistory(newH);
      const nw=[...winners,item];
      if(ci+1<matchups.length){setCi(p=>p+1);setWinners(nw);}
      else{
        if(nw.length===1){SFX.play("victory");onFinish(nw[0],newH);return;}
        SFX.play("round");
        const np=[];for(let i=0;i<nw.length;i+=2)np.push([nw[i],nw[i+1]]);
        setMatchups(np);setCi(0);setWinners([]);setRound(nw.length);setCrn(p=>p+1);
      }
      setSelected(null);setAnimating(false);animRef.current=false;setSpectatorPct(null);
      pickTimeRef.current=Date.now();
    },600);
  },[ci,matchups,winners,onFinish,round,history]);

  if(!matchups.length||!matchups[ci])return null;
  const[left,right]=matchups[ci]; const mn=ci+1; const mt=matchups.length;
  const progress=((crn-1)/totalRounds)*100+(mn/mt/totalRounds)*100;
  const rl=round===2?t.final:round===4?t.semis:`${t.roundOf} ${round}`;

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"var(--textDim)",fontFamily:"'Outfit',sans-serif",fontSize:14,cursor:"pointer",marginBottom:12}}>{t.backToBrowse}</button>
        <h2 style={{fontFamily:"'Outfit',sans-serif",fontSize:22,fontWeight:800,color:"var(--text)",margin:0,marginBottom:8}}>{tournament.title}</h2>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:14,color:"var(--accent)",marginBottom:16}}>{rl} · {t.match} {mn}/{mt}</div>
        <div style={{width:"100%",maxWidth:400,height:4,background:"var(--border)",borderRadius:2,margin:"0 auto",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,background:"linear-gradient(90deg,var(--accent),var(--accentAlt))",borderRadius:2,transition:"width 0.4s ease"}}/>
        </div>

      </div>
      <div className="vs-matchup-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,position:"relative"}}>
        {[left,right].map((item,si)=>{
          const isSel=selected===item.id; const isLos=selected&&!isSel;
          const other=si===0?right:left;


          return (
            <div key={`s${si}-r${crn}-m${ci}`} onClick={()=>handlePick(item,other)} style={{
              position:"relative",borderRadius:20,overflow:"hidden",cursor:animating?"default":"pointer",
              pointerEvents:animating?"none":"auto",border:`2px solid ${isSel?"var(--accent)":"var(--border)"}`,
              transition:"all 0.4s",transform:isSel?"scale(1.05)":isLos?"scale(0.95)":"scale(1)",
              opacity:isLos?0.4:1,boxShadow:isSel?"0 0 40px var(--accentGlow)":"var(--cardShadow)",
            }}>
              <SafeImage src={item.img} fallbackSrc={item.fallbackImg || itemGradientImg(item.name)} alt={item.name} style={{width:"100%",height:"100%",minHeight:"clamp(220px,40vw,380px)",objectFit:"cover",display:"block"}}/>
              {/* Video data stored in DB for future use */}
              {/* Video countdown overlay */}



              {/* Audio playing indicator */}
              <AudioBars active={!!item.audioUrl && AudioEngine.enabled && !animating} />
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.1) 50%,transparent 100%)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"18px 20px",pointerEvents:"none"}}>
                <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:"clamp(16px,4vw,24px)",fontWeight:800,color:"#fff",margin:0,textShadow:"0 2px 10px rgba(0,0,0,0.5)"}}>{item.name}</h3>
                {(item.snippet||item.tagline)&&(
                  <div style={{marginTop:6,display:"flex",alignItems:"flex-start",gap:6}}>
                    {item.snippetType==="dialogue"&&<span style={{fontSize:12,flexShrink:0}}>🎬</span>}
                    {item.snippetType==="lyric"&&<span style={{fontSize:12,flexShrink:0}}>🎵</span>}
                    {item.snippetType==="quote"&&<span style={{fontSize:12,flexShrink:0}}>💬</span>}
                    {item.snippetType==="stat"&&<span style={{fontSize:12,flexShrink:0}}>📊</span>}
                    {item.snippetType==="fact"&&<span style={{fontSize:12,flexShrink:0}}>💡</span>}
                    <div>
                      <p style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:"rgba(255,255,255,0.85)",margin:0,fontStyle:item.snippetType==="dialogue"||item.snippetType==="lyric"?"italic":"normal",lineHeight:1.3}}>
                        {item.snippetType==="dialogue"?`"${item.snippet||item.tagline}"`:item.snippet||item.tagline}
                      </p>
                      {item.snippetSource&&<p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>— {item.snippetSource}</p>}
                    </div>
                  </div>
                )}
              </div>
              {isSel&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:48,animation:"pop 0.3s ease",color:"#fff",textShadow:"0 0 30px var(--accent)"}}>✓</div>}
            </div>
          );
        })}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:10,pointerEvents:"none"}}>
          <span style={{display:"inline-block",width:56,height:56,lineHeight:"56px",borderRadius:"50%",background:"var(--bg)",border:"3px solid var(--accent)",fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700,color:"var(--accent)",boxShadow:"0 0 30px var(--accentGlow),0 0 60px rgba(255,51,102,0.2)",textAlign:"center",animation:"vsPulse 1.5s ease-in-out infinite"}}>VS</span>
        </div>
      </div>
      {/* Spectator stat flash */}
      {spectatorPct!==null&&selected&&(
        <div style={{textAlign:"center",marginTop:12,fontFamily:"'Outfit',sans-serif",fontSize:13,color:"var(--accentAlt)",animation:"fadeIn 0.3s ease"}}>
          {spectatorPct}% {t.ofPlayersAgreed}
        </div>
      )}
      {/* Keyboard shortcut hint */}
      <div style={{textAlign:"center",marginTop:14,fontFamily:"'Space Mono',monospace",fontSize:12,color:"var(--textDim)",opacity:0.5,letterSpacing:1}}>
        ← A&nbsp;&nbsp;|&nbsp;&nbsp;D →
      </div>
    </div>
  );
}

// ============================================================
// FEEDBACK SYSTEM (feature requests + bug reports)
// ============================================================
function FeedbackModal({ onClose, lang }) {
  const [type, setType] = useState("feature"); // "feature" | "bug" | "other"
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(""); // which page they're on

  useEffect(() => {
    // Track which page the user was on when they opened feedback
    setPage(document.title || window.location.pathname || "unknown");
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    if (!rateLimit("feedback", 10000)) return; // 10s cooldown between submissions
    const payload = {
      type,
      message: message.trim().slice(0, 1000),
      email: email.trim().slice(0, 100) || "",
      page,
      user_agent: navigator.userAgent,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      locale: navigator.language||"en",
      status: "new",
    };
    try {
      await fetch(API_ENDPOINTS.feedback, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
    } catch(e) { console.error("Feedback save error:", e); }
    setSubmitted(true);
  };

  const types = [
    { id: "feature", emoji: "💡", label: "Feature Request" },
    { id: "bug", emoji: "🐛", label: "Bug Report" },
    { id: "other", emoji: "💬", label: "Other Feedback" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: "32px 28px", maxWidth: 440, width: "92%", position: "relative" }}>
        {/* Close button */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "var(--textDim)", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>

        {!submitted ? (<>
          <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>Send Feedback</h3>
          <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, color: "var(--textDim)", margin: "0 0 20px" }}>Help us make VS WORLDCUP better</p>

          {/* Type selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {types.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer",
                background: type === t.id ? "var(--accentGlow)" : "var(--surfaceLight)",
                border: `1px solid ${type === t.id ? "var(--accent)" : "var(--border)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 20 }}>{t.emoji}</span>
                <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 700, color: type === t.id ? "var(--accent)" : "var(--textDim)" }}>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Message */}
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={1000}
            placeholder={type === "bug" ? "Describe the bug... What happened? What did you expect?" : type === "feature" ? "What feature would make this better?" : "Tell us anything..."}
            style={{
              width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 12, resize: "vertical",
              border: "1px solid var(--border)", background: "var(--surfaceLight)", color: "var(--text)",
              fontFamily: "'Outfit',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box",
            }} />
          <div style={{ textAlign: "right", marginTop: 4, marginBottom: 14 }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "var(--textDim)" }}>{message.length}/1000</span>
          </div>

          {/* Email (optional) */}
          <input value={email} onChange={e => setEmail(e.target.value)} maxLength={100}
            placeholder="Email (optional — for follow-up)"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, marginBottom: 18, boxSizing: "border-box",
              border: "1px solid var(--border)", background: "var(--surfaceLight)", color: "var(--text)",
              fontFamily: "'Outfit',sans-serif", fontSize: 14, outline: "none",
            }} />

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!message.trim()} style={{
            width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: message.trim() ? "pointer" : "not-allowed",
            background: message.trim() ? "linear-gradient(135deg,var(--accent),#ff6699)" : "var(--surfaceLight)",
            color: message.trim() ? "#fff" : "var(--textDim)",
            fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 700,
          }}>Send {types.find(t => t.id === type)?.emoji}</button>
        </>) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
            <h3 style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>Thank you!</h3>
            <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, color: "var(--textDim)", margin: "0 0 24px" }}>Your feedback helps us improve VS WORLDCUP</p>
            <button onClick={onClose} style={{
              padding: "11px 28px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "var(--accent)", color: "#fff",
              fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 700,
            }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Floating Action Button (always visible bottom-right)
function FeedbackFAB({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title="Send Feedback"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 999,
        width: hover ? "auto" : 48, height: 48, borderRadius: 24,
        background: "linear-gradient(135deg, var(--accent), #ff6699)",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", gap: hover ? 8 : 0, padding: hover ? "0 18px 0 14px" : 0,
        boxShadow: "0 4px 20px var(--accentGlow)", transition: "all 0.3s ease",
        transform: hover ? "scale(1.05)" : "scale(1)",
      }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>💬</span>
      {hover && <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>Feedback</span>}
    </button>
  );
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const[lang,setLang]=useState("en"); const[themeMode,setThemeMode]=useState("dark");
  const[view,setView]=useState("home");
  const[selectedTournament,setST]=useState(null); const[bracketSize,setBS]=useState(null);
  const[winner,setWinner]=useState(null); const[matchHistory,setMH]=useState([]);
  const[soundEnabled,setSE]=useState(true);
  const[quickPicks,setQP]=useState([]);
  const[showFeedback,setShowFeedback]=useState(false);
  const[sortMode,setSortMode]=useState("popular");
  const[resumeGame,setResumeGame]=useState(null);

  // Demographics & onboarding
  const[demographics,setDemo]=useState(null); // {ageRange, gender, country, region, city}
  const[showOnboarding,setShowOnboarding]=useState(false);
  const[playsBeforeOnboard,setPBO]=useState(0);

  // Track view in a ref so effects can read the latest value without depending on it
  const viewRef=useRef("home");
  useEffect(()=>{viewRef.current=view;},[view]);

  const { tournaments, setTournaments, dailyChallenge, isLoading } = useTournaments(
    SAMPLE_TOURNAMENTS,
    () => _gid++,
    itemGradientImg
  );
  const { recentPlays, addRecentPlay } = useRecentPlays();

  // Inject mobile-responsive styles
  useEffect(()=>{
    const id = "vs-mobile-styles";
    if(!document.getElementById(id)){
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @media(max-width:640px){
          .vs-matchup-grid{grid-template-columns:1fr 1fr !important;gap:8px !important;}
          .vs-matchup-grid>div{min-height:220px !important;}
          .vs-matchup-grid img{min-height:220px !important;}
          .vs-tournament-grid{grid-template-columns:1fr !important;gap:14px !important;}
        }
        @keyframes pulse{0%,100%{opacity:1;transform:translateX(-50%) scale(1)}50%{opacity:0.7;transform:translateX(-50%) scale(1.05)}}
      `;
      document.head.appendChild(style);
    }
  },[]);

  // URL-based tournament routing (only on initial page load)
  const initialPathRef=useRef(window.location.pathname);
  const initialSearchRef=useRef(window.location.search);
  const urlRoutedRef=useRef(false);
  useEffect(()=>{
    if(urlRoutedRef.current)return;
    if(viewRef.current!=="home"){urlRoutedRef.current=true;return;}
    const path = initialPathRef.current;
    if(!path.startsWith("/t/")){urlRoutedRef.current=true;return;}
    const isResults = /\/results$/.test(path);
    const tid = path.slice(3).replace(/\/results$/, "");
    const found = tournaments.find(t=>t.id===tid);
    if(!found){urlRoutedRef.current=true;return;}
    const params = new URLSearchParams(initialSearchRef.current || "");
    const winnerName = params.get("winner");
    if(isResults && winnerName){
      const foundWinner = found.items.find(i => i.name === winnerName);
      if(foundWinner){
        setST(found);
        setWinner(foundWinner);
        setMH([]);
        setView("winner");
        urlRoutedRef.current=true;
        return;
      }
    }
    urlRoutedRef.current=true;
    setST(found);
    setView("roundSelect");
  },[tournaments]);

  // Update URL when selecting/leaving a tournament
  useEffect(()=>{
    if(view==="play"&&selectedTournament){
      window.history.replaceState(null,"",`/t/${selectedTournament.id}`);
    } else if(view==="winner"&&selectedTournament&&winner){
      const qs = new URLSearchParams({ winner: winner.name }).toString();
      window.history.replaceState(null,"",`/t/${selectedTournament.id}/results?${qs}`);
    } else if(view==="home"){
      window.history.replaceState(null,"","/");
    }
  },[view,selectedTournament,winner]);

  // Location detection (IP-based fallback via timezone)
  useEffect(()=>{
    try{
      const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"";
      const parts=tz.split("/");
      if(parts.length>=2){
        setDemo(prev=>({...prev,timezone:tz,region:parts[1]?.replace(/_/g," ")}));
      }
    }catch(e){}
  },[]);

  useEffect(()=>{
    const active = loadActiveGame();
    if (!active || !active.tournamentId) { setResumeGame(null); return; }
    const found = tournaments.find(t=>t.id===active.tournamentId);
    if(found) setResumeGame({ ...active, title: found.title, image: found.items?.[0]?.img || found.items?.[1]?.img || "" });
    else setResumeGame(null);
  },[tournaments]);

  const maybeOnboard=()=>{
    if(playsBeforeOnboard>=2&&!demographics?.ageRange&&!isOnboardingDismissed()) setShowOnboarding(true);
  };

  const toggleSound=()=>{const r=SFX.toggle();setSE(r);};
  const th=THEMES[themeMode];
  const cssVars=Object.entries(th).map(([k,v])=>`--${k.replace(/([A-Z])/g,m=>"-"+m.toLowerCase())}:${v};--${k}:${v};`).join("");

  const handleGameFinish=(w,h)=>{
    setWinner(w);setMH(h);
    setTournaments(p=>p.map(t=>t.id===selectedTournament?.id?{...t,plays:t.plays+1}:t));
    setView("winner");
    setPBO(p=>p+1);
    clearActiveGame();
    setResumeGame(null);
    saveLastResult({ tournamentId: selectedTournament?.id, winner: w.name, finishedAt: Date.now() });
    // Save to recently played (localStorage)
    try{const rp={id:selectedTournament?.id,title:selectedTournament?.title||"Unknown",champion:w.name,timestamp:Date.now()};
      addRecentPlay(rp);
    }catch(e){}
    // Save play session + match results to PocketBase (single batched call)
    if (!rateLimit("gameFinish", 3000)) return; // 3s cooldown
    try {
      const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
      const payload = {
        session_id: sessionId,
        tournament_id: selectedTournament?.id || "unknown",
        tournament_title: selectedTournament?.title || "Unknown",
        category: selectedTournament?.category || "custom",
        champion_name: w.name,
        total_rounds: h.length,
        avg_pick_time: h.length > 0 ? +(h.reduce((a,m)=>a+m.time,0)/h.length).toFixed(2) : 0,
        bracket_size: selectedTournament?.items?.length || 0,
        locale: navigator.language || "en",
        screen_size: window.innerWidth + "x" + window.innerHeight,
        user_agent: navigator.userAgent,
        matches: h.map((m,i) => ({
          round: m.round, match_index: m.matchIdx,
          winner_name: m.winner.name, loser_name: m.loser.name,
          pick_time: +m.time.toFixed(2), match_number: i + 1,
        })),
      };
      fetch(API_ENDPOINTS.playSessions, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload),
      }).catch(()=>{});
    } catch(e) { console.error("Session save error:", e); }
  };

  const handleOnboardComplete=(data)=>{
    setDemo(prev=>({...prev,...data}));
    setShowOnboarding(false);
  };

  const handleOnboardDismiss=()=>{
    dismissOnboarding();
    setShowOnboarding(false);
  };

  return (
    <div style={{minHeight:"100vh",background:th.bg,color:th.text}}>
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href={FONT_LINK} rel="stylesheet"/>
      <style>{`
        :root{${cssVars}}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:var(--bg);overflow-x:hidden;color:var(--text);}
        @keyframes pop{0%{transform:translate(-50%,-50%) scale(0);opacity:0}60%{transform:translate(-50%,-50%) scale(1.3);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes fadeIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes audioBar{0%{height:4px}100%{height:16px}}
        @keyframes pulse{0%{opacity:1}50%{opacity:0.5}100%{opacity:1}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes vsPulse{0%,100%{transform:translate(-50%,-50%) scale(1);box-shadow:0 0 20px var(--accentGlow),0 0 40px rgba(255,51,102,0.15)}50%{transform:translate(-50%,-50%) scale(1.08);box-shadow:0 0 35px var(--accentGlow),0 0 60px rgba(255,51,102,0.25)}}
        img{user-select:none;-webkit-user-drag:none;}
        input::placeholder{color:var(--text-dim,#88889955);}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
      `}</style>

      {/* Onboarding modal */}
      {showOnboarding&&<OnboardingModal onComplete={handleOnboardComplete} onDismiss={handleOnboardDismiss} lang={lang}/>}

      <Header currentView={view} setView={setView} setSelectedTournament={setST} lang={lang} setLang={setLang} themeMode={themeMode} setThemeMode={setThemeMode} soundEnabled={soundEnabled} toggleSound={toggleSound}/>

      {view==="home"&&<HomeView tournaments={tournaments} dailyChallenge={dailyChallenge} recentPlays={recentPlays} resumeGame={resumeGame} onResumeGame={(game)=>{const found=tournaments.find(t=>t.id===game?.tournamentId); if(found){setST(found); setBS(game.bracketSize||found.items.length||16); setView("play");}}} onSelect={tr=>{setST(tr);setView("roundSelect");}} setView={setView} onQuickMode={()=>setView("quick")} onDailyChallenge={()=>{setST(dailyChallenge);setBS(16);setView("play");}} lang={lang} sortMode={sortMode} setSortMode={setSortMode} T={T} CATEGORIES={CATEGORIES}/>}

      {view==="create"&&<CreateView onCreated={newT=>{
        setTournaments(p=>[newT,...p]);setST(newT);setView("roundSelect");
        fetch(API_ENDPOINTS.tournaments,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            tournament_id:newT.id,title:newT.title,category:newT.category||"custom",
            author:newT.author||"Anonymous",plays:0,featured:false,status:"active",
            items:newT.items.map(i=>({name:i.name,snippet:i.snippet||"",snippetType:i.snippetType||"none",img:i.img||""}))
          })
        }).then(r=>{if(r.ok)console.log("Tournament saved to DB");}).catch(()=>{});
      }} lang={lang} T={T} CATEGORIES={CATEGORIES} AiGenerator={AiGenerator} isValidUrl={isValidUrl} itemGradientImg={itemGradientImg} getNextId={()=>_gid++} />}

      {view==="roundSelect"&&selectedTournament&&selectedTournament.items&&<RoundSelector itemCount={selectedTournament.items.length} onSelect={s=>{try{setBS(s);setView("play");}catch(e){console.error("Bracket select error:",e);}}} lang={lang} T={T}/>}

      {view==="play"&&selectedTournament&&bracketSize&&<GamePlay tournament={selectedTournament} bracketSize={bracketSize} onFinish={handleGameFinish} onStart={(payload)=>{saveActiveGame(payload); setResumeGame(payload);}} onBack={()=>{setView("home");setST(null);}} lang={lang}/>}

      {view==="winner"&&selectedTournament&&winner&&<WinnerScreen tournament={selectedTournament} winner={winner} history={matchHistory} demographics={demographics} onPlayAgain={()=>{clearActiveGame(); setResumeGame(null); setView("home");setST(null);setWinner(null);maybeOnboard();}} onRematch={()=>{setView("play");}} onViewRanking={()=>setView("rankings")} onBack={()=>{clearActiveGame(); setResumeGame(null); setView("home");setST(null);setWinner(null);maybeOnboard();}} lang={lang} T={T} SFX={SFX} itemGradientImg={itemGradientImg} />}

      {view==="rankings"&&selectedTournament&&<RankingsView tournament={selectedTournament} onBack={()=>{setView("home");setST(null);}} lang={lang} T={T} formatNumber={formatNumber} getWinRate={getWinRate} />}

      {view==="quick"&&<QuickMode tournaments={tournaments} onFinish={picks=>{setQP(picks);setView("quickResults");}} SFX={SFX} shuffleArray={shuffleArray} lang={lang} T={T} />}

      {view==="quickResults"&&<QuickResults picks={quickPicks} onPlayAgain={()=>setView("quick")} onGoHome={()=>setView("home")} lang={lang} T={T} />}

      {/* Floating feedback button + modal */}
      <FeedbackFAB onClick={()=>setShowFeedback(true)} />
      {showFeedback&&<FeedbackModal onClose={()=>setShowFeedback(false)} lang={lang}/>}
    </div>
  );
}
