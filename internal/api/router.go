package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"ai-analytics-dashboard/internal/auth"
	"ai-analytics-dashboard/internal/processor"
	"ai-analytics-dashboard/internal/store"
	"ai-analytics-dashboard/internal/stripe"
)

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func SetupRoutes(r *gin.Engine, s *store.Store) {
	p := processor.NewAnalyticsProcessor(s)
	st := stripe.NewClient()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
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
			
			// Check quota
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

			// Increment query count
			s.IncrementQueryCount(userID)

			// Save report
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
