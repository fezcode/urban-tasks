package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

// roundTripFunc lets us stub the HTTP transport.
type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func jsonResp(body string) *http.Response {
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func TestGeocodeSearchParsesAndCaches(t *testing.T) {
	var calls int32
	body := `[{"display_name":"Blue Bottle Coffee, 1 Main St","lat":"37.8","lon":"-122.2"}]`
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		atomic.AddInt32(&calls, 1)
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing User-Agent")
		}
		return jsonResp(body), nil
	})}
	svc := NewGeocodeService("https://nominatim.example", "urban-tasks-test/1.0", client)

	got, err := svc.Search(context.Background(), "blue bottle")
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(got) != 1 || got[0].Name != "Blue Bottle Coffee, 1 Main St" {
		t.Fatalf("unexpected result: %+v", got)
	}
	if got[0].Lat != 37.8 || got[0].Lon != -122.2 {
		t.Fatalf("bad coords: %+v", got[0])
	}

	// Second identical query is served from cache (no second HTTP call).
	if _, err := svc.Search(context.Background(), "blue bottle"); err != nil {
		t.Fatalf("search 2: %v", err)
	}
	if c := atomic.LoadInt32(&calls); c != 1 {
		t.Fatalf("expected 1 upstream call (cached), got %d", c)
	}
}

func TestGeocodeSearchEmptyQuery(t *testing.T) {
	svc := NewGeocodeService("https://x", "ua", http.DefaultClient)
	got, err := svc.Search(context.Background(), "   ")
	if err != nil || len(got) != 0 {
		t.Fatalf("empty query: got %v err %v", got, err)
	}
}
