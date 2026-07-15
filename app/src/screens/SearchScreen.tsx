import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { SearchResponse } from "../lib/types";
import { SearchBar } from "../components/SearchBar";
import { RestaurantCardView } from "../components/RestaurantCard";
import { formatPrice } from "../lib/format";

const RECENT_KEY = "feastnow_recent_searches";
const MAX_RECENT = 8;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function readRecent(): string[] {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

function pushRecent(term: string): string[] {
  const next = [term, ...readRecent().filter((t) => t !== term)].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(res);
        setRecent(pushRecent(q));
      } catch {
        setResults({ restaurants: [], dishes: [] });
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  const noMatches = results !== null && !searching
    && results.restaurants.length === 0 && results.dishes.length === 0;

  return (
    <main className="screen search">
      <header className="search__header">
        <button className="search__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <SearchBar value={query} onChange={setQuery} autoFocus />
      </header>

      {results === null && recent.length > 0 && (
        <section className="recent">
          <div className="recent__head">
            <h2 className="serif">Recent searches</h2>
            <button className="recent__clear" onClick={() => {
              window.localStorage.removeItem(RECENT_KEY);
              setRecent([]);
            }}>Clear</button>
          </div>
          {recent.map((term) => (
            <button key={term} className="recent__item" onClick={() => setQuery(term)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
              {term}
            </button>
          ))}
        </section>
      )}

      {searching && <p className="search__status mono" role="status">Searching…</p>}
      {noMatches && <p className="search__status">No matches for "{query.trim()}".</p>}

      {results && results.restaurants.length > 0 && (
        <section className="search__group">
          <h2 className="serif">Restaurants</h2>
          <div className="grid">
            {results.restaurants.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
          </div>
        </section>
      )}

      {results && results.dishes.length > 0 && (
        <section className="search__group">
          <h2 className="serif">Dishes</h2>
          {results.dishes.map((dish) => (
            <Link key={dish.id} to={`/restaurant/${dish.restaurantId}`} className="dish-hit">
              {dish.imageUrl
                ? <img className="dish-hit__thumb" src={dish.imageUrl} alt="" loading="lazy" />
                : <div className="dish-hit__thumb dish-hit__thumb--empty" aria-hidden="true" />}
              <div className="dish-hit__text">
                <h3>{dish.name}</h3>
                <p>{dish.restaurantName}</p>
              </div>
              <span className="dish-hit__price mono">{formatPrice(dish.priceCents)}</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
