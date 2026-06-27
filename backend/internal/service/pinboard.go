package service

import (
	"context"
	"errors"

	"urban-tasks/internal/model"
	"urban-tasks/internal/repository"
)

var (
	ErrCardNotFound       = errors.New("pinboard card not found")
	ErrConnectionNotFound = errors.New("pinboard connection not found")
	ErrTaskAlreadyPinned  = errors.New("task already pinned")
	ErrTasksNotPinned     = errors.New("both tasks must be pinned")
	ErrSelfConnection     = errors.New("cannot connect a task to itself")
)

type PinboardService struct {
	pinboard *repository.PinboardRepo
	tasks    *repository.TaskRepo
	projects *repository.ProjectRepo
}

func NewPinboardService(pinboard *repository.PinboardRepo, tasks *repository.TaskRepo, projects *repository.ProjectRepo) *PinboardService {
	return &PinboardService{pinboard: pinboard, tasks: tasks, projects: projects}
}

// requireMember returns ErrProjectNotFound unless the user is a member of the project.
func (s *PinboardService) requireMember(ctx context.Context, projectID, userID string) error {
	p, err := s.projects.GetByID(ctx, projectID, userID)
	if err != nil {
		return err
	}
	if p == nil {
		return ErrProjectNotFound
	}
	return nil
}

func (s *PinboardService) GetBoard(ctx context.Context, projectID, userID string) (*model.PinboardBoard, error) {
	if err := s.requireMember(ctx, projectID, userID); err != nil {
		return nil, err
	}
	cards, err := s.pinboard.ListCards(ctx, projectID)
	if err != nil {
		return nil, err
	}
	conns, err := s.pinboard.ListConnections(ctx, projectID)
	if err != nil {
		return nil, err
	}
	bgColor, err := s.pinboard.GetBoardColor(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if cards == nil {
		cards = []model.PinboardCard{}
	}
	if conns == nil {
		conns = []model.PinboardConnection{}
	}
	return &model.PinboardBoard{Cards: cards, Connections: conns, BgColor: bgColor}, nil
}

// SetBoardColor sets (or clears, via empty/invalid input) the cork background color.
func (s *PinboardService) SetBoardColor(ctx context.Context, projectID, userID string, req model.UpdatePinboardBoardRequest) (*string, error) {
	if err := s.requireMember(ctx, projectID, userID); err != nil {
		return nil, err
	}
	color := model.SanitizeColor(req.BgColor)
	if err := s.pinboard.SetBoardColor(ctx, projectID, color); err != nil {
		return nil, err
	}
	return color, nil
}

// LinkedTasks returns the tasks strung to a given task on its project's board.
func (s *PinboardService) LinkedTasks(ctx context.Context, taskID, userID string) ([]model.PinboardLinkedTask, error) {
	out, err := s.pinboard.ListLinkedTasks(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	if out == nil {
		out = []model.PinboardLinkedTask{}
	}
	return out, nil
}

func (s *PinboardService) PinCard(ctx context.Context, projectID, userID string, req model.CreatePinboardCardRequest) (*model.PinboardCard, error) {
	if err := s.requireMember(ctx, projectID, userID); err != nil {
		return nil, err
	}
	// Task must exist, be visible to the user, and belong to this project.
	t, err := s.tasks.GetByID(ctx, req.TaskID, userID)
	if err != nil {
		return nil, err
	}
	if t == nil || t.ProjectID != projectID {
		return nil, ErrTaskNotFound
	}
	pinned, err := s.pinboard.IsTaskPinned(ctx, projectID, req.TaskID)
	if err != nil {
		return nil, err
	}
	if pinned {
		return nil, ErrTaskAlreadyPinned
	}
	c := &model.PinboardCard{
		ProjectID: projectID,
		TaskID:    req.TaskID,
		X:         model.SanitizeBoardCoord(req.X),
		Y:         model.SanitizeBoardCoord(req.Y),
	}
	if err := s.pinboard.CreateCard(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// UpdateCard applies any provided position and/or color change to a card.
func (s *PinboardService) UpdateCard(ctx context.Context, cardID, userID string, req model.UpdatePinboardCardRequest) (*model.PinboardCard, error) {
	c, err := s.pinboard.CardByID(ctx, cardID, userID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, ErrCardNotFound
	}
	if req.X != nil {
		c.X = model.SanitizeBoardCoord(*req.X)
	}
	if req.Y != nil {
		c.Y = model.SanitizeBoardCoord(*req.Y)
	}
	if req.Color != nil {
		// Present color: a valid hex sets it, anything else clears (auto).
		c.Color = model.SanitizeColor(req.Color)
	}
	if err := s.pinboard.UpdateCard(ctx, c.ID, c.X, c.Y, c.Color); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *PinboardService) UnpinCard(ctx context.Context, cardID, userID string) error {
	c, err := s.pinboard.CardByID(ctx, cardID, userID)
	if err != nil {
		return err
	}
	if c == nil {
		return ErrCardNotFound
	}
	// Remove any string touching this task first, then the card itself.
	if err := s.pinboard.DeleteConnectionsForTask(ctx, c.ProjectID, c.TaskID); err != nil {
		return err
	}
	return s.pinboard.DeleteCard(ctx, c.ID)
}

func (s *PinboardService) Connect(ctx context.Context, projectID, userID string, req model.CreatePinboardConnectionRequest) (*model.PinboardConnection, error) {
	if err := s.requireMember(ctx, projectID, userID); err != nil {
		return nil, err
	}
	if req.FromTaskID == req.ToTaskID {
		return nil, ErrSelfConnection
	}
	// Both tasks must already be pinned on this board.
	for _, tid := range []string{req.FromTaskID, req.ToTaskID} {
		pinned, err := s.pinboard.IsTaskPinned(ctx, projectID, tid)
		if err != nil {
			return nil, err
		}
		if !pinned {
			return nil, ErrTasksNotPinned
		}
	}
	a, b := model.NormalizePair(req.FromTaskID, req.ToTaskID)
	c := &model.PinboardConnection{
		ProjectID: projectID,
		ATaskID:   a,
		BTaskID:   b,
		Label:     model.SanitizeConnectionLabel(req.Label),
	}
	if err := s.pinboard.CreateConnection(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *PinboardService) Relabel(ctx context.Context, connID, userID string, req model.UpdatePinboardConnectionRequest) (*model.PinboardConnection, error) {
	c, err := s.pinboard.ConnectionByID(ctx, connID, userID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, ErrConnectionNotFound
	}
	c.Label = model.SanitizeConnectionLabel(req.Label)
	if err := s.pinboard.UpdateConnectionLabel(ctx, c.ID, c.Label); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *PinboardService) Disconnect(ctx context.Context, connID, userID string) error {
	c, err := s.pinboard.ConnectionByID(ctx, connID, userID)
	if err != nil {
		return err
	}
	if c == nil {
		return ErrConnectionNotFound
	}
	return s.pinboard.DeleteConnection(ctx, c.ID)
}
