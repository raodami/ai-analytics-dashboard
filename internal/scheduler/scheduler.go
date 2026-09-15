package scheduler

import (
	"sync"
	"time"
)

type ScheduleJob struct {
	ID          string
	UserID      string
	Name        string
	SQL         string
	Query       string
	ChartType   string
	Interval    time.Duration
	LastRun     time.Time
	NextRun     time.Time
	Enabled     bool
}

type Scheduler struct {
	mu       sync.Mutex
	jobs     map[string]*ScheduleJob
	running  map[string]bool
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		jobs:  make(map[string]*ScheduleJob),
		running: make(map[string]bool),
	}
}

func (s *Scheduler) AddJob(job *ScheduleJob) {
	s.mu.Lock()
	defer s.mu.Unlock()
	job.NextRun = time.Now().Add(job.Interval)
	s.jobs[job.ID] = job
	go s.runJob(job.ID)
}

func (s *Scheduler) RemoveJob(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.running[id] = false
	delete(s.jobs, id)
}

func (s *Scheduler) GetJobs(userID string) []*ScheduleJob {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	var jobs []*ScheduleJob
	for _, job := range s.jobs {
		if job.UserID == userID {
			jobs = append(jobs, job)
		}
	}
	return jobs
}

func (s *Scheduler) ToggleJob(id string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	job, ok := s.jobs[id]
	if !ok {
		return nil
	}
	job.Enabled = enabled
	if enabled {
		s.running[id] = true
		go s.runJob(id)
	} else {
		s.running[id] = false
	}
	return nil
}

func (s *Scheduler) runJob(id string) {
	for {
		time.Sleep(1 * time.Second)
		
		s.mu.Lock()
		job, ok := s.jobs[id]
		running := s.running[id]
		s.mu.Unlock()
		
		if !ok || !running {
			return
		}
		
		now := time.Now()
		if now.After(job.NextRun) {
			// Execute job
			job.LastRun = now
			job.NextRun = now.Add(job.Interval)
			
			// Trigger update via channel or callback
			// This would typically call the processor
			go func() {
				// Handle execution
				_ = job
			}()
		}
	}
}

func (s *Scheduler) GetJob(id string) (*ScheduleJob, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	job, ok := s.jobs[id]
	return job, ok
}
