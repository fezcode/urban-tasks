package model

import "testing"

func TestSanitizeBoardCoord(t *testing.T) {
	cases := []struct {
		name string
		in   float64
		want float64
	}{
		{"passes through", 123.5, 123.5},
		{"clamps high", 1e9, 100000},
		{"clamps low", -1e9, -100000},
		{"zero stays zero", 0, 0},
	}
	for _, c := range cases {
		if got := SanitizeBoardCoord(c.in); got != c.want {
			t.Errorf("%s: SanitizeBoardCoord(%v) = %v, want %v", c.name, c.in, got, c.want)
		}
	}
}

func TestSanitizeConnectionLabel(t *testing.T) {
	long := make([]rune, 120)
	for i := range long {
		long[i] = 'a'
	}
	if got := SanitizeConnectionLabel("  hello  "); got != "hello" {
		t.Errorf("trim: got %q", got)
	}
	if got := SanitizeConnectionLabel("   "); got != "" {
		t.Errorf("blank: got %q", got)
	}
	if got := SanitizeConnectionLabel(string(long)); len([]rune(got)) != maxConnectionLabelLen {
		t.Errorf("cap: len = %d, want %d", len([]rune(got)), maxConnectionLabelLen)
	}
}

func TestNormalizePair(t *testing.T) {
	a, b := NormalizePair("zzz", "aaa")
	if a != "aaa" || b != "zzz" {
		t.Errorf("NormalizePair(zzz,aaa) = (%q,%q), want (aaa,zzz)", a, b)
	}
	a, b = NormalizePair("aaa", "zzz")
	if a != "aaa" || b != "zzz" {
		t.Errorf("NormalizePair(aaa,zzz) = (%q,%q), want (aaa,zzz)", a, b)
	}
}
