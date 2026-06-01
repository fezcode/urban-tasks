package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"urban-tasks/internal/model"
)

// GeocodeService wraps OSM Nominatim with a User-Agent, a ~1 req/s throttle,
// and an in-memory TTL cache, per OSM's usage policy.
type GeocodeService struct {
	baseURL   string
	userAgent string
	client    *http.Client

	throttleMu sync.Mutex
	lastCall   time.Time
	minGap     time.Duration

	cacheMu sync.Mutex
	cache   map[string]cacheEntry
	ttl     time.Duration
	maxKeys int
}

type cacheEntry struct {
	results []model.Location
	expires time.Time
}

func NewGeocodeService(baseURL, userAgent string, client *http.Client) *GeocodeService {
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	return &GeocodeService{
		baseURL:   strings.TrimRight(baseURL, "/"),
		userAgent: userAgent,
		client:    client,
		minGap:    time.Second,
		cache:     make(map[string]cacheEntry),
		ttl:       24 * time.Hour,
		maxKeys:   1000,
	}
}

func (s *GeocodeService) Search(ctx context.Context, q string) ([]model.Location, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return []model.Location{}, nil
	}
	key := "s:" + strings.ToLower(q)
	if cached, ok := s.getCache(key); ok {
		return cached, nil
	}
	u := fmt.Sprintf("%s/search?format=jsonv2&limit=5&q=%s", s.baseURL, url.QueryEscape(q))
	results, err := s.fetchList(ctx, u)
	if err != nil {
		return nil, err
	}
	s.putCache(key, results)
	return results, nil
}

func (s *GeocodeService) Reverse(ctx context.Context, lat, lon float64) (*model.Location, error) {
	key := fmt.Sprintf("r:%.5f,%.5f", lat, lon)
	if cached, ok := s.getCache(key); ok {
		if len(cached) == 0 {
			return nil, nil
		}
		return &cached[0], nil
	}
	u := fmt.Sprintf("%s/reverse?format=jsonv2&lat=%s&lon=%s",
		s.baseURL, strconv.FormatFloat(lat, 'f', -1, 64), strconv.FormatFloat(lon, 'f', -1, 64))
	loc, err := s.fetchOne(ctx, u)
	if err != nil {
		return nil, err
	}
	if loc == nil {
		s.putCache(key, []model.Location{})
		return nil, nil
	}
	s.putCache(key, []model.Location{*loc})
	return loc, nil
}

// nominatimItem is the subset of Nominatim's JSON we consume.
type nominatimItem struct {
	DisplayName string `json:"display_name"`
	Name        string `json:"name"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
}

func (n nominatimItem) toLocation() (model.Location, bool) {
	lat, err1 := strconv.ParseFloat(n.Lat, 64)
	lon, err2 := strconv.ParseFloat(n.Lon, 64)
	if err1 != nil || err2 != nil {
		return model.Location{}, false
	}
	label := n.DisplayName
	if label == "" {
		label = n.Name
	}
	return model.Location{Name: label, Lat: lat, Lon: lon}, true
}

func (s *GeocodeService) fetchList(ctx context.Context, u string) ([]model.Location, error) {
	body, err := s.do(ctx, u)
	if err != nil {
		return nil, err
	}
	var items []nominatimItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("decoding nominatim: %w", err)
	}
	out := make([]model.Location, 0, len(items))
	for _, it := range items {
		if loc, ok := it.toLocation(); ok {
			out = append(out, loc)
		}
	}
	return out, nil
}

func (s *GeocodeService) fetchOne(ctx context.Context, u string) (*model.Location, error) {
	body, err := s.do(ctx, u)
	if err != nil {
		return nil, err
	}
	var it nominatimItem
	if err := json.Unmarshal(body, &it); err != nil {
		return nil, fmt.Errorf("decoding nominatim: %w", err)
	}
	loc, ok := it.toLocation()
	if !ok {
		return nil, nil
	}
	return &loc, nil
}

func (s *GeocodeService) do(ctx context.Context, u string) ([]byte, error) {
	s.throttle()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("Accept", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nominatim status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func (s *GeocodeService) throttle() {
	s.throttleMu.Lock()
	defer s.throttleMu.Unlock()
	if wait := s.minGap - time.Since(s.lastCall); wait > 0 {
		time.Sleep(wait)
	}
	s.lastCall = time.Now()
}

func (s *GeocodeService) getCache(key string) ([]model.Location, bool) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	e, ok := s.cache[key]
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e.results, true
}

func (s *GeocodeService) putCache(key string, results []model.Location) {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	if len(s.cache) >= s.maxKeys {
		s.cache = make(map[string]cacheEntry) // simple bounded reset
	}
	s.cache[key] = cacheEntry{results: results, expires: time.Now().Add(s.ttl)}
}
