# ScalePass AWS

A production-style AWS-centered event reservation platform designed to handle high-concurrency reservation spikes.

## Goal

Build a portfolio-grade system that can support 10,000+ users during a reservation rush while preventing overselling.

## Core Challenge

Many users attempt to reserve limited-capacity event seats at the same time.

The system must remain correct, observable, secure, and scalable under load.

## Target Load

- 10,000 users entering within 5 minutes
- 500–1,000 peak requests/sec
- No overselling
- P95 read latency under 500ms
- P95 reservation latency under 1.5s during spike
- Error rate under 1%

## Planned Stack

- Frontend: Next.js / React
- Backend: Node.js, TypeScript, Fastify
- Database: PostgreSQL / Aurora
- Cache: Redis / ElastiCache
- Queue: SQS
- Runtime: ECS Fargate
- Infra: Terraform
- Load testing: k6
- Observability: CloudWatch