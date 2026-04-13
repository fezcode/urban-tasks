FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# ---

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata
RUN adduser -D -H appuser

WORKDIR /app
COPY --from=builder /server .
COPY migrations/ ./migrations/

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
