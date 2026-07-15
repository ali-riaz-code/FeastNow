import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { HomeResponse, RestaurantCard, RestaurantListResponse, RestaurantSort } from "../lib/types";
import { RestaurantCardView } from "../components/RestaurantCard";
import { Chip } from "../components/Chip";
import { SectionRow } from "../components/SectionRow";
import { SkeletonCard } from "../components/SkeletonCard";
import { SearchBar } from "../components/SearchBar";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const SORT_LABELS: Record<RestaurantSort, string> = {
  popular: "Most popular", rating: "Top rated", delivery_time: "Fastest delivery",
};

type FeedState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; home: HomeResponse };

export function HomeScreen() {
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  const [feed, setFeed] = useState<FeedState>({ status: "loading" });
  const [cuisine, setCuisine] = useState<string>("All");
  const [sort, setSort] = useState<RestaurantSort>("popular");

  // All Restaurants grid (also serves as the filtered feed when a chip is active)
  const [gridItems, setGridItems] = useState<RestaurantCard[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [gridTotal, setGridTotal] = useState<number | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState(false);
  const [gridEpoch, setGridEpoch] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    setFeed({ status: "loading" });
    try {
      setFeed({ status: "ready", home: await apiGet<HomeResponse>("/api/customer/home") });
    } catch {
      setFeed({ status: "error" });
    }
  }, []);

  useEffect(() => { void loadFeed(); }, [loadFeed]);

  // Reset the grid whenever the filter or sort changes.
  useEffect(() => {
    setGridItems([]);
    setGridPage(1);
    setGridTotal(null);
    setGridError(false);
  }, [cuisine, sort]);

  // Load grid pages. gridEpoch is bumped by pull-to-refresh / retry to force a
  // re-fetch even when gridPage is already 1 (setGridPage(1) would otherwise be
  // a no-op by value identity and never re-trigger this effect).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setGridLoading(true);
      try {
        const params = new URLSearchParams({ page: String(gridPage), sort });
        if (cuisine !== "All") params.set("cuisine", cuisine);
        const res = await apiGet<RestaurantListResponse>(`/api/restaurants?${params}`);
        if (cancelled) return;
        setGridItems((prev) => (gridPage === 1 ? res.restaurants : [...prev, ...res.restaurants]));
        setGridTotal(res.total);
        setGridError(false);
      } catch {
        if (cancelled) return;
        if (gridPage === 1) {
          setGridTotal(null);
          setGridError(true);
        }
        // Page >= 2 failures leave existing items/total intact so the sentinel
        // or a future retry can attempt the same page again.
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [cuisine, sort, gridPage, gridEpoch]);

  // Infinite scroll sentinel.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      const hasMore = gridTotal !== null && gridItems.length < gridTotal;
      if (entries[0].isIntersecting && hasMore && !gridLoading) {
        setGridPage((p) => p + 1);
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [gridItems.length, gridTotal, gridLoading]);

  const refreshing = usePullToRefresh(mainRef, useCallback(async () => {
    setGridItems([]); setGridPage(1); setGridTotal(null); setGridError(false);
    setGridEpoch((e) => e + 1);
    await loadFeed();
  }, [loadFeed]));

  const retryGrid = useCallback(() => {
    setGridError(false);
    setGridEpoch((e) => e + 1);
  }, []);

  const cuisines = feed.status === "ready" ? feed.home.cuisines : [];

  return (
    <main className="screen home" ref={mainRef}>
      <header className="home__header">
        <button className="location-pill" type="button" aria-label="Delivery address (demo)">
          <span className="location-pill__label">Deliver to</span>
          <span className="location-pill__value">· Demo Address</span>
        </button>
        <SearchBar readOnly onTap={() => navigate("/search")} />
      </header>

      {refreshing && <p className="home__refreshing mono" role="status">Refreshing…</p>}

      {feed.status === "error" ? (
        <div className="home__error">
          <p>Couldn't load the feed — check your connection and try again.</p>
          <button className="btn-retry" onClick={() => void loadFeed()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="chip-row" role="group" aria-label="Filter by cuisine">
            <Chip label="All" selected={cuisine === "All"} onClick={() => setCuisine("All")} />
            {cuisines.map((c) => (
              <Chip key={c} label={c} selected={cuisine === c} onClick={() => setCuisine(c)} />
            ))}
          </div>

          {cuisine === "All" && (
            feed.status === "loading" ? (
              <SectionRow title=" ">
                {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
              </SectionRow>
            ) : (
              feed.home.sections.map((section) => (
                <SectionRow key={section.key} title={section.title}>
                  {section.restaurants.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
                </SectionRow>
              ))
            )
          )}

          <section className="all-restaurants">
            <div className="all-restaurants__head">
              <h2 className="serif">{cuisine === "All" ? "All Restaurants" : cuisine}</h2>
              <select className="sort-select" value={sort} aria-label="Sort restaurants"
                onChange={(e) => setSort(e.target.value as RestaurantSort)}>
                {(Object.keys(SORT_LABELS) as RestaurantSort[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </div>
            {gridError ? (
              <div className="home__error">
                <p>Couldn't load restaurants — check your connection and try again.</p>
                <button className="btn-retry" onClick={retryGrid}>Try again</button>
              </div>
            ) : (
              <>
                <div className="grid">
                  {gridItems.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
                  {gridLoading && Array.from({ length: 4 }, (_, i) => <SkeletonCard key={`s${i}`} />)}
                </div>
                {gridTotal === 0 && <p className="home__empty">No restaurants match this filter.</p>}
              </>
            )}
            <div ref={sentinelRef} aria-hidden="true" />
          </section>
        </>
      )}
    </main>
  );
}
