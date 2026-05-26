export default function ScoresLoading() {
  return (
    <div className="flex-1 flex flex-col p-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-10 w-40 bg-slate-200 rounded-lg"></div>
      </div>

      {/* Main Layout Skeleton */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
        {/* Left Side List Skeleton (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 space-y-6 flex flex-col shadow-sm">
          {/* Filters Skeleton */}
          <div className="flex gap-4">
            <div className="h-10 flex-1 bg-slate-100 rounded-xl"></div>
            <div className="h-10 flex-1 bg-slate-100 rounded-xl"></div>
          </div>

          {/* Table List Skeleton */}
          <div className="flex-1 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    <div className="h-3 w-48 bg-slate-100 rounded"></div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-12 h-6 bg-slate-150 rounded-full"></div>
                  <div className="w-8 h-6 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Skeleton */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-50">
            <div className="h-4 w-40 bg-slate-100 rounded"></div>
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-8 h-8 bg-slate-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Detail Placeholder Skeleton (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
          </div>
          <div className="h-5 w-56 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-72 bg-slate-100 rounded"></div>
        </div>
      </div>
    </div>
  );
}
