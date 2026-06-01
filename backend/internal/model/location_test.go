package model

import "testing"

func TestSanitizeLocation(t *testing.T) {
	long := make([]byte, 300)
	for i := range long {
		long[i] = 'a'
	}

	cases := []struct {
		name    string
		in      *Location
		wantNil bool
		wantLen int // expected len of Name when not nil
	}{
		{"nil stays nil", nil, true, 0},
		{"valid passes", &Location{Name: "Blue Bottle", Lat: 37.8, Lon: -122.2}, false, 11},
		{"lat out of range -> nil", &Location{Name: "x", Lat: 91, Lon: 0}, true, 0},
		{"lon out of range -> nil", &Location{Name: "x", Lat: 0, Lon: 181}, true, 0},
		{"empty name -> nil", &Location{Name: "  ", Lat: 1, Lon: 1}, true, 0},
		{"name trimmed + capped", &Location{Name: "  " + string(long) + "  ", Lat: 1, Lon: 1}, false, 256},
	}
	for _, c := range cases {
		got := SanitizeLocation(c.in)
		if c.wantNil {
			if got != nil {
				t.Errorf("%s: want nil, got %+v", c.name, got)
			}
			continue
		}
		if got == nil {
			t.Fatalf("%s: want non-nil", c.name)
		}
		if len([]rune(got.Name)) != c.wantLen {
			t.Errorf("%s: name len = %d, want %d", c.name, len([]rune(got.Name)), c.wantLen)
		}
	}
}
