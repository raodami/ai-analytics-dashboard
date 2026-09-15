package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"ai-analytics-dashboard/internal/auth"
	"ai-analytics-dashboard/internal/processor"
	"ai-analytics-dashboard/internal/store"
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

			// Check if user exists
			_, err := s.GetUserByEmail(req.Email)
			if err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
				return
			}

			// Create user
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

	// Protected routes
	protected := r.Group("/api")
	protected.Use(authMiddleware(s))
	{
		// Query endpoint
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

			userID, _ := c.Get("user_id")
			result, err := p.ProcessQuery(userID.(string), req.NaturalQuery, req.DataSourceID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Save report
			reportID := uuid.New().String()
			if err := s.CreateReport(reportID, userID.(string), req.NaturalQuery, result.SQL, req.NaturalQuery, result.ChartType, string(result.Data)); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save report"})
				return
			}

			c.JSON(http.StatusOK, result)
		})

		// Get reports
		protected.GET("/reports", func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			reports, err := s.GetReports(userID.(string))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, reports)
		})

		// Get user info
		protected.GET("/me", func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			user, err := s.GetUserByID(userID.(string))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"id": user.ID,
				"email": user.Email,
				"is_pro": user.IsPro,
				"query_count": user.QueryCount,
			})
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
