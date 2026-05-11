export function ModulesLoadingSpinner() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
            </div>
            <p className="text-gray-500 font-medium animate-pulse">Sincronizando Módulos...</p>
        </div>
    );
}
