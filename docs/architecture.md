# Architecture

## Initial Local Architecture

```txt
React / Next.js frontend
        ↓
Fastify API
        ↓
PostgreSQL
        ↓
Redis
        ↓
SQS-compatible background jobs