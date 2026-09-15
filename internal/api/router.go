package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"ai-analytics-dashboard/internal/auth"
	"ai-analytics-dashboard/internal/chart"
	"ai-analytics-dashboard/internal/datasource"
	"ai-analytics-dashboard/internal/export"
	"ai-analytics-dashboard/internal/processor"
	"ai-analytics-dashboard/internal/scheduler"
	"ai-analytics-dashboard/internal/store"
	"ai-analytics-dashboard/internal/stripe"
)

// Simple cache for query results
type cacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

var queryCache = make(map[string]cacheEntry)
var cacheMu sync.RWMutex

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type DataSourceRequest struct {
	Name       string `json:"name" binding:"required"`
	Type       string `json:"type" binding:"required"`
	Connection string `json:"connection" binding:"required"`
}

type ScheduleRequest struct {
	Name      string        `json:"name" binding:"required"`
	SQL       string        `json:"sql" binding:"required"`
	Query     string        `json:"query"`
	Interval  string        `json:"interval"`
	ChartType string        `json:"chart_type"`
}

func SetupRoutes(r *gin.Engine, s *store.Store) {
	p := processor.NewAnalyticsProcessor(s)
	st := stripe.NewClient()
	wh := stripe.NewWebhookConfig()
	ss := scheduler.NewScheduler()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Stripe Webhook
	r.POST("/webhook/stripe", func(c *gin.Context) {
		payload, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
			return
		}

		sig := c.GetHeader("Stripe-Signature")
		valid, err := wh.VerifySignature(payload, sig)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}

		event, err := wh.ParseEvent(payload)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		switch event.Type {
		case "checkout.session.completed":
			userID, err := wh.HandleCheckoutCompleted(event)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if userID != "" {
				s.SetUserPro(userID, true)
			}

		case "customer.subscription.updated", "customer.subscription.created":
			userID, err := wh.HandleSubscriptionUpdated(event, "")
			if err != nil && userID != "" {
				s.SetUserPro(userID, true)
			}
		}

		c.JSON(http.StatusOK, gin.H{"received": true})
	})

	// Auth routes
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", func(c *gin.Context) {
			var req RegisterRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			_, err := s.GetUserByEmail(req.Email)
			if err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
				return
			}

			userID := uuid.New().String()
			if err := s.CreateUser(userID, req.Email, req.Password); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
				return
			}

			token, err := auth.GenerateToken(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
				return
			}

			c.JSON(http.StatusCreated, gin.H{"token": token, "user_id": userID})
		})

		authGroup.POST("/login", func(c *gin.Context) {
			var req LoginRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			user, err := s.GetUserByEmail(req.Email)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
				return
			}

			if user.Password != req.Password {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
				return
			}

			token, err := auth.GenerateToken(user.ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"token": token, "user": map[string]interface{}{
				"id": user.ID,
				"email": user.Email,
				"is_pro": user.IsPro,
			}})
		})

		authGroup.POST("/logout", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "logged out"})
		})
	}

	// Public routes
	publicGroup := r.Group("/api")
	{
		publicGroup.GET("/pricing/plans", func(c *gin.Context) {
			c.JSON(http.StatusOK, st.GetPlans())
		})
	}

	// Protected routes
	protected := r.Group("/api")
	protected.Use(authMiddleware(s))
	{
		protected.POST("/query", func(c *gin.Context) {
			type QueryRequest struct {
				NaturalQuery string `json:"natural_query" binding:"required"`
				DataSourceID string `json:"data_source_id"`
			}
			var req QueryRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			userID := c.MustGet("user_id").(string)
			
			user, _ := s.GetUserByID(userID)
			if !user.IsPro && user.QueryCount >= 10 {
				c.JSON(http.StatusForbidden, gin.H{"error": "daily query limit reached. Upgrade to Pro for unlimited queries."})
				return
			}

			result, err := p.ProcessQuery(userID, req.NaturalQuery, req.DataSourceID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			s.IncrementQueryCount(userID)

			reportID := uuid.New().String()
			if err := s.CreateReport(reportID, userID, req.NaturalQuery, result.SQL, req.NaturalQuery, result.ChartType, string(result.Data)); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save report"})
				return
			}

			c.JSON(http.StatusOK, result)
		})

		protected.GET("/reports", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			reports, err := s.GetReports(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, reports)
		})

		protected.GET("/reports/:id", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			reportID := c.Param("id")

			report, err := s.GetReport(reportID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
				return
			}

			if report.UserID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}

			c.JSON(http.StatusOK, report)
		})

		protected.DELETE("/reports/:id", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			reportID := c.Param("id")

			report, err := s.GetReport(reportID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
				return
			}

			if report.UserID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}

			if err := s.DeleteReport(reportID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "report deleted"})
		})

		protected.GET("/reports/:id/export/:format", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			reportID := c.Param("id")
			format := c.Param("format")

			report, err := s.GetReport(reportID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
				return
			}

			if report.UserID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}

			var data []map[string]interface{}
			json.Unmarshal([]byte(report.Result), &data)
			if len(data) == 0 {
				c.JSON(http.StatusNotFound, gin.H{"error": "no data in report"})
				return
			}

			var content string
			var contentType string
			var filename string

			switch format {
			case "csv":
				content, err = export.ExportCSV(data)
				contentType = "text/csv"
				filename = fmt.Sprintf("report_%s.csv", reportID)
			case "json":
				content, err = export.ExportJSON(data)
				contentType = "application/json"
				filename = fmt.Sprintf("report_%s.json", reportID)
			case "markdown":
				content, err = export.ExportMarkdown(data)
				contentType = "text/markdown"
				filename = fmt.Sprintf("report_%s.md", reportID)
			default:
				c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported format"})
				return
			}

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
			c.Data(http.StatusOK, contentType, []byte(content))
		})

		protected.GET("/me", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			user, err := s.GetUserByID(userID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"id": user.ID,
				"email": user.Email,
				"is_pro": user.IsPro,
				"query_count": user.QueryCount,
				"free_quota": 10,
				"remaining": max(0, 10-user.QueryCount),
			})
		})

		protected.POST("/checkout", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			type CheckoutRequest struct {
				PlanID string `json:"plan_id" binding:"required"`
			}
			var req CheckoutRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			user, _ := s.GetUserByID(userID)
			sessionURL, err := st.CreateCheckoutSession(user.Email, userID, req.PlanID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"url": sessionURL})
		})

		// Data Sources
		protected.GET("/datasources", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			sources, err := s.GetDataSources(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, sources)
		})

		protected.POST("/datasources", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			var req DataSourceRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			dsID := uuid.New().String()
			if err := s.CreateDataSource(dsID, userID, req.Name, req.Type, req.Connection); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, gin.H{"id": dsID, "name": req.Name, "type": req.Type})
		})

		protected.DELETE("/datasources/:id", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			dsID := c.Param("id")

			// Verify ownership
			sources, err := s.GetDataSources(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			found := false
			for _, ds := range sources {
				if ds.ID == dsID {
					found = true
					break
				}
			}
			if !found {
				c.JSON(http.StatusNotFound, gin.H{"error": "data source not found"})
				return
			}

			// Delete from DB
			err = s.DeleteDataSource(dsID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "data source deleted"})
		})

		protected.POST("/datasources/:id/schema", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			dsID := c.Param("id")

			sources, err := s.GetDataSources(userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			var ds *store.DataSource
			for _, source := range sources {
				if source.ID == dsID {
					ds = source
					break
				}
			}
			if ds == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "data source not found"})
				return
			}

			schema, err := datasource.GetSchemaByType(ds.Type, ds.Connection)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"schema": schema})
		})

		// Scheduled Reports
		protected.GET("/schedules", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			jobs := ss.GetJobs(userID)
			c.JSON(http.StatusOK, jobs)
		})

		protected.POST("/schedules", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			var req ScheduleRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			interval, err := time.ParseDuration(req.Interval)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid interval format"})
				return
			}

			jobID := uuid.New().String()
			job := &scheduler.ScheduleJob{
				ID:        jobID,
				UserID:    userID,
				Name:      req.Name,
				SQL:       req.SQL,
				Query:     req.Query,
				ChartType: req.ChartType,
				Interval:  interval,
				Enabled:   true,
			}
			ss.AddJob(job)

			// Save to DB
			if err := s.CreateReport(jobID, userID, req.Name, req.SQL, req.Query, req.ChartType, "scheduled"); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, job)
		})

		protected.DELETE("/schedules/:id", func(c *gin.Context) {
			jobID := c.Param("id")

			ss.RemoveJob(jobID)
			s.DeleteReport(jobID)

			c.JSON(http.StatusOK, gin.H{"message": "schedule deleted"})
		})

		protected.POST("/schedules/:id/toggle", func(c *gin.Context) {
			userID := c.MustGet("user_id").(string)
			jobID := c.Param("id")

			job, ok := ss.GetJob(jobID)
			if !ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
				return
			}
			if job.UserID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
				return
			}

			// Toggle enabled state
			ss.ToggleJob(jobID, !job.Enabled)

			c.JSON(http.StatusOK, gin.H{"enabled": !job.Enabled})
		})
	}
}

func authMiddleware(s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		tokenStr, err := auth.ExtractTokenFromHeader(authHeader)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token format"})
			c.Abort()
			return
		}

		userID, err := auth.ValidateToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
