/**
 * Vocabulário de ícones do Alliance System — Phosphor Icons.
 *
 * Por que existe este arquivo:
 *  1. Um único ponto de normalização. Antes, `strokeWidth` variava entre
 *     1.75 / 1.8 / 2.1 / 2.2 e o tamanho entre 8 e 26px, escolhidos ad hoc.
 *     Aqui o peso é sempre `regular` (pontas e junções arredondadas) e o
 *     tamanho vem de uma escala fixa.
 *  2. Compatibilidade com a API do Lucide. Os nomes exportados são os mesmos
 *     que o projeto já usava, então migrar um arquivo é trocar o caminho do
 *     import. `strokeWidth` é aceito e descartado de propósito.
 *
 * Usa a entrada `/ssr` do Phosphor: funciona em Server e Client Components.
 *
 * Escala de tamanho — use os tokens, não números soltos:
 *   ICON.xs (14) chips e badges · ICON.sm (16) inline em texto
 *   ICON.md (18) padrão, nav, botões · ICON.lg (22) cabeçalho de seção
 *   ICON.xl (28) estado vazio, destaque
 */
import type { ComponentType, SVGProps } from 'react'
import type { IconWeight } from '@phosphor-icons/react'
import {
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsLeftRight as PhArrowsLeftRight,
  Bathtub as PhBathtub,
  Bed as PhBed,
  Bell as PhBell,
  Buildings as PhBuildings,
  Calendar as PhCalendar,
  CalendarCheck as PhCalendarCheck,
  CalendarDots as PhCalendarDots,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  CaretUpDown as PhCaretUpDown,
  ChartBar as PhChartBar,
  ChatCircle as PhChatCircle,
  ChatCircleDots as PhChatCircleDots,
  ChatCircleSlash as PhChatCircleSlash,
  ChatText as PhChatText,
  ChatsCircle as PhChatsCircle,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  Copy as PhCopy,
  CornersOut as PhCornersOut,
  Crown as PhCrown,
  CurrencyDollar as PhCurrencyDollar,
  DeviceMobile as PhDeviceMobile,
  DotsSixVertical as PhDotsSixVertical,
  DotsThree as PhDotsThree,
  Envelope as PhEnvelope,
  FileText as PhFileText,
  Fire as PhFire,
  FloppyDisk as PhFloppyDisk,
  Funnel as PhFunnel,
  Gauge as PhGauge,
  GearSix as PhGearSix,
  House as PhHouse,
  Info as PhInfo,
  Kanban as PhKanban,
  Lightning as PhLightning,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  Moon as PhMoon,
  Note as PhNote,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Pause as PhPause,
  PauseCircle as PhPauseCircle,
  PencilLine as PhPencilLine,
  PencilSimple as PhPencilSimple,
  PencilSimpleLine as PhPencilSimpleLine,
  Phone as PhPhone,
  PhoneCall as PhPhoneCall,
  Play as PhPlay,
  Plus as PhPlus,
  PlusCircle as PhPlusCircle,
  Prohibit as PhProhibit,
  Pulse as PhPulse,
  QrCode as PhQrCode,
  Robot as PhRobot,
  ShieldCheck as PhShieldCheck,
  Shuffle as PhShuffle,
  Sidebar as PhSidebar,
  SidebarSimple as PhSidebarSimple,
  SlidersHorizontal as PhSlidersHorizontal,
  Smiley as PhSmiley,
  Snowflake as PhSnowflake,
  SortAscending as PhSortAscending,
  Sparkle as PhSparkle,
  Square as PhSquare,
  SquaresFour as PhSquaresFour,
  Stack as PhStack,
  Sun as PhSun,
  Tag as PhTag,
  Target as PhTarget,
  Thermometer as PhThermometer,
  ThermometerHot as PhThermometerHot,
  Timer as PhTimer,
  Trash as PhTrash,
  TrendDown as PhTrendDown,
  TrendUp as PhTrendUp,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserPlus as PhUserPlus,
  Users as PhUsers,
  Warning as PhWarning,
  X as PhX,
} from '@phosphor-icons/react/dist/ssr'

/** Escala de tamanho do sistema. */
export const ICON = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
} as const

type PhosphorComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string; weight?: IconWeight; mirrored?: boolean }
>

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string
  weight?: IconWeight
  /** Aceito por compatibilidade com a API do Lucide. Ignorado de propósito:
   *  o peso do traço é decidido pelo sistema, não pelo call site. */
  strokeWidth?: number
}

export type IconComponent = (props: IconProps) => React.ReactElement

/**
 * Envolve um ícone do Phosphor com os padrões do sistema e descarta
 * `strokeWidth`, para que os call sites herdados continuem compilando.
 */
function icon(Component: PhosphorComponent, defaultWeight: IconWeight = 'regular'): IconComponent {
  const Wrapped = ({ size = ICON.md, weight = defaultWeight, strokeWidth: _sw, ...rest }: IconProps) => (
    <Component size={size} weight={weight} {...rest} />
  )
  Wrapped.displayName = `Icon(${Component.displayName ?? 'Phosphor'})`
  return Wrapped
}

/* --- Navegação e layout -------------------------------------------------- */
export const LayoutDashboard = icon(PhSquaresFour)
export const Kanban = icon(PhKanban)
export const PanelLeftClose = icon(PhSidebarSimple)
export const PanelLeftOpen = icon(PhSidebar)
export const Maximize = icon(PhCornersOut)
export const Settings = icon(PhGearSix)
export const ExternalLink = icon(PhArrowSquareOut)

/* --- Direção -------------------------------------------------------------- */
export const ChevronDown = icon(PhCaretDown, 'bold')
export const ChevronUp = icon(PhCaretUp, 'bold')
export const ChevronLeft = icon(PhCaretLeft, 'bold')
export const ChevronRight = icon(PhCaretRight, 'bold')
export const ChevronsUpDown = icon(PhCaretUpDown, 'bold')
export const ArrowLeft = icon(PhArrowLeft)
export const ArrowRight = icon(PhArrowRight)
export const ArrowLeftRight = icon(PhArrowsLeftRight)
export const ArrowDownNarrowWide = icon(PhSortAscending)
export const MoreHorizontal = icon(PhDotsThree, 'bold')
export const GripVertical = icon(PhDotsSixVertical, 'bold')

/* --- Ações ---------------------------------------------------------------- */
export const Plus = icon(PhPlus, 'bold')
export const PlusCircle = icon(PhPlusCircle)
export const Check = icon(PhCheck, 'bold')
export const CheckCircle2 = icon(PhCheckCircle)
export const X = icon(PhX, 'bold')
export const Pencil = icon(PhPencilSimple)
export const Edit3 = icon(PhPencilSimpleLine)
export const PenLine = icon(PhPencilLine)
export const Trash2 = icon(PhTrash)
export const Save = icon(PhFloppyDisk)
export const Send = icon(PhPaperPlaneTilt)
export const RefreshCw = icon(PhArrowsClockwise)
export const RotateCcw = icon(PhArrowCounterClockwise)
export const Play = icon(PhPlay, 'fill')
export const Pause = icon(PhPause, 'fill')
export const PauseCircle = icon(PhPauseCircle)
export const Copy = icon(PhCopy)
export const Search = icon(PhMagnifyingGlass)
export const Filter = icon(PhFunnel)
export const SlidersHorizontal = icon(PhSlidersHorizontal)
export const Loader2 = icon(PhCircleNotch, 'bold')

/* --- Domínio: leads, imóveis, pipeline ------------------------------------ */
export const Home = icon(PhHouse)
export const Building2 = icon(PhBuildings)
export const Users = icon(PhUsers)
export const User = icon(PhUser)
export const UserCheck = icon(PhUserCheck)
export const UserPlus = icon(PhUserPlus)
export const Bot = icon(PhRobot)
export const Crown = icon(PhCrown, 'fill')
export const Layers = icon(PhStack)
export const Tag = icon(PhTag)
export const Tags = icon(PhTag)
export const Target = icon(PhTarget)
export const ClipboardList = icon(PhClipboardText)
export const Smartphone = icon(PhDeviceMobile)
export const QrCode = icon(PhQrCode)
export const Shuffle = icon(PhShuffle)
export const Sparkles = icon(PhSparkle, 'fill')
export const Timer = icon(PhTimer)
export const Activity = icon(PhPulse, 'bold')
export const MapPin = icon(PhMapPin)
export const DollarSign = icon(PhCurrencyDollar)
export const BedDouble = icon(PhBed)
export const Bath = icon(PhBathtub)
export const Square = icon(PhSquare)

/* --- Temperatura e score -------------------------------------------------- */
export const Snowflake = icon(PhSnowflake)
export const Thermometer = icon(PhThermometer)
export const ThermometerSun = icon(PhThermometerHot)
export const Flame = icon(PhFire, 'fill')
export const Zap = icon(PhLightning, 'fill')
export const Gauge = icon(PhGauge)
export const TrendingUp = icon(PhTrendUp, 'bold')
export const TrendingDown = icon(PhTrendDown, 'bold')
export const BarChart3 = icon(PhChartBar)

/* --- Comunicação ---------------------------------------------------------- */
export const MessageSquare = icon(PhChatText)
export const MessagesSquare = icon(PhChatsCircle)
export const MessageCircle = icon(PhChatCircle)
export const MessageSquareOff = icon(PhChatCircleSlash)
export const MessageCircleOff = icon(PhChatCircleSlash)
export const MessageCircleReply = icon(PhChatCircleDots)
export const Ban = icon(PhProhibit)
export const Phone = icon(PhPhone)
export const PhoneCall = icon(PhPhoneCall)
export const Mail = icon(PhEnvelope)
export const StickyNote = icon(PhNote)
export const FileText = icon(PhFileText)

/* --- Tempo ---------------------------------------------------------------- */
export const Calendar = icon(PhCalendar)
export const CalendarCheck = icon(PhCalendarCheck)
export const CalendarDays = icon(PhCalendarDots)
export const Clock = icon(PhClock)
export const Clock3 = icon(PhClock)

/* --- Estado e sistema ----------------------------------------------------- */
export const AlertTriangle = icon(PhWarning)
export const Info = icon(PhInfo)
export const ShieldCheck = icon(PhShieldCheck)
export const Bell = icon(PhBell)
export const Smile = icon(PhSmiley)
export const Sun = icon(PhSun)
export const Moon = icon(PhMoon)
