import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Globe,
  Search,
  BookmarkPlus,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function WebSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // parse ?q= from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) {
      setQuery(q);
    }
  }, [location.search]);

  // Execute search if 'query' has a value
  const {
    data: results,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["webSearch", query],
    queryFn: async () => {
      if (!query) return null;
      return api.get(`/api/search/web?q=${encodeURIComponent(query)}`);
    },
    enabled: !!query,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const bookmarkMutation = useMutation({
    mutationFn: (url: string) => api.post("/api/bookmarks", { url }),
    onSuccess: () => {
      alert("Bookmarked successfully! Background scrape started.");
    },
    onError: (err: any) => {
      alert(`Bookmark failed: ${err.message || "Unknown error"}`);
    },
  });

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col font-sans">
      <div className="flex items-center gap-3 mb-8 shrink-0">
        <Globe size={28} className="text-emerald-500" />
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
          Web Search
        </h1>
      </div>

      <form onSubmit={handleSearch} className="mb-8 relative shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web (via SearXNG)..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-4 pl-12 text-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-xl"
        />
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          size={24}
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          Search
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4 text-emerald-500" size={32} />
            <p>Searching multiple engines...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
            <p className="font-semibold mb-1">Search failed</p>
            <p className="text-sm">
              {(error as any)?.message || "Engine timeout or unavailable"}
            </p>
          </div>
        )}

        {results && results.results && (
          <div className="space-y-6 pb-20">
            {results.results.map((result: any, i: number) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className="text-lg font-medium text-blue-400 hover:text-blue-300">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <span
                        dangerouslySetInnerHTML={{
                          __html:
                            result.title ||
                            result.parsed_url?.[1] ||
                            "No title",
                        }}
                      />
                      <ExternalLink size={14} className="opacity-50" />
                    </a>
                  </h3>
                  <button
                    onClick={() => bookmarkMutation.mutate(result.url)}
                    className="text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 text-xs font-medium bg-slate-800 px-2 py-1 rounded shrink-0"
                  >
                    <BookmarkPlus size={14} /> Bookmark
                  </button>
                </div>
                <div className="text-sm text-emerald-600/80 mb-2 truncate max-w-full font-mono">
                  {result.parsed_url?.join("") || result.url}
                </div>
                <p
                  className="text-sm text-slate-300 leading-relaxed max-w-full overflow-hidden text-ellipsis"
                  dangerouslySetInnerHTML={{
                    __html: result.content || result.snippet || "",
                  }}
                />
                {result.engines && result.engines.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {result.engines.map((eng: string) => (
                      <span
                        key={eng}
                        className="text-[10px] uppercase font-semibold tracking-wider bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded"
                      >
                        {eng}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
