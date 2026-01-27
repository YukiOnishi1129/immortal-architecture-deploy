# =============================================================================
# Backend Dockerfile for Cloud Run
# Multi-stage build for Go API
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM golang:1.25-alpine AS builder

# Install necessary packages for CGO (if needed) and certificates
RUN apk add --no-cache ca-certificates git

WORKDIR /app

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
# CGO_ENABLED=0 for static binary (no C dependencies)
# -ldflags="-s -w" to strip debug info and reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/api ./cmd/api

# -----------------------------------------------------------------------------
# Stage 2: Runtime
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/bin/api /app/api

# Copy migrations (for Cloud Build migration step)
COPY --from=builder /app/migrations /app/migrations

# Cloud Run uses PORT environment variable
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Run as non-root user (distroless/nonroot default)
USER nonroot:nonroot

# Run the binary
ENTRYPOINT ["/app/api"]
