package service

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SearchService struct {
	pool *pgxpool.Pool
}

func NewSearchService(pool *pgxpool.Pool) *SearchService {
	return &SearchService{pool: pool}
}

type TaskHit struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Snippet     string  `json:"snippet"`
	ProjectID   string  `json:"projectId"`
	ProjectName string  `json:"projectName,omitempty"`
	Status      string  `json:"status"`
	Rank        float64 `json:"rank"`
}

type CommentHit struct {
	ID          string  `json:"id"`
	TaskID      string  `json:"taskId"`
	TaskTitle   string  `json:"taskTitle"`
	Snippet     string  `json:"snippet"`
	AuthorName  string  `json:"authorName,omitempty"`
	ProjectID   string  `json:"projectId"`
	ProjectName string  `json:"projectName,omitempty"`
	Rank        float64 `json:"rank"`
}

type SearchResult struct {
	Tasks    []TaskHit    `json:"tasks"`
	Comments []CommentHit `json:"comments"`
}

// toTSQuery turns a free-form user query into a tsquery, prefixing each
// alphanumeric run with `:*` for prefix matching, and AND-joining them.
// Empty input yields an empty string (caller should short-circuit).
func toTSQuery(q string) string {
	q = strings.TrimSpace(q)
	if q == "" {
		return ""
	}
	parts := strings.FieldsFunc(q, func(r rune) bool {
		return !(r == '_' || r == '-' || (r >= '0' && r <= '9') ||
			(r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'))
	})
	cleaned := make([]string, 0, len(parts))
	for _, p := range parts {
		if p == "" {
			continue
		}
		cleaned = append(cleaned, p+":*")
	}
	return strings.Join(cleaned, " & ")
}

func (s *SearchService) Search(ctx context.Context, userID, q string, limit int) (SearchResult, error) {
	out := SearchResult{Tasks: []TaskHit{}, Comments: []CommentHit{}}
	tsq := toTSQuery(q)
	if tsq == "" {
		return out, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	// Tasks
	taskRows, err := s.pool.Query(ctx, `
		SELECT t.id, t.title,
		       ts_headline('simple',
		                   COALESCE(t.body, '') || ' ' || t.title,
		                   to_tsquery('simple', $1),
		                   'StartSel=<,StopSel=>,MaxFragments=1,MaxWords=12,MinWords=4'),
		       t.project_id, COALESCE(p.name, ''), t.status,
		       ts_rank(t.search_vector, to_tsquery('simple', $1)) AS rank
		FROM tasks t
		JOIN project_members m ON m.project_id = t.project_id AND m.user_id = $2
		LEFT JOIN projects p ON p.id = t.project_id
		WHERE t.search_vector @@ to_tsquery('simple', $1)
		ORDER BY rank DESC, t.updated_at DESC
		LIMIT $3
	`, tsq, userID, limit)
	if err != nil {
		return out, err
	}
	for taskRows.Next() {
		var h TaskHit
		if err := taskRows.Scan(&h.ID, &h.Title, &h.Snippet, &h.ProjectID, &h.ProjectName, &h.Status, &h.Rank); err != nil {
			taskRows.Close()
			return out, err
		}
		out.Tasks = append(out.Tasks, h)
	}
	taskRows.Close()

	// Comments
	commentRows, err := s.pool.Query(ctx, `
		SELECT c.id, c.task_id, t.title,
		       ts_headline('simple', c.body, to_tsquery('simple', $1),
		                   'StartSel=<,StopSel=>,MaxFragments=1,MaxWords=14,MinWords=5'),
		       COALESCE(u.name, ''), t.project_id, COALESCE(p.name, ''),
		       ts_rank(c.search_vector, to_tsquery('simple', $1)) AS rank
		FROM task_comments c
		JOIN tasks t ON t.id = c.task_id
		JOIN project_members m ON m.project_id = t.project_id AND m.user_id = $2
		LEFT JOIN projects p ON p.id = t.project_id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.search_vector @@ to_tsquery('simple', $1)
		ORDER BY rank DESC, c.created_at DESC
		LIMIT $3
	`, tsq, userID, limit)
	if err != nil {
		return out, err
	}
	defer commentRows.Close()
	for commentRows.Next() {
		var h CommentHit
		if err := commentRows.Scan(&h.ID, &h.TaskID, &h.TaskTitle, &h.Snippet, &h.AuthorName, &h.ProjectID, &h.ProjectName, &h.Rank); err != nil {
			return out, err
		}
		out.Comments = append(out.Comments, h)
	}
	return out, nil
}
