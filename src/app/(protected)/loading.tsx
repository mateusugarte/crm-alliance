export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-alliance-blue/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-alliance-blue border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-xs text-gray-400 font-medium">Carregando...</p>
      </div>
    </div>
  )
}
