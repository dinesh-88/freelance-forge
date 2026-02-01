# syntax=docker/dockerfile:1

FROM rust:1.85-slim AS builder

WORKDIR /app

# Install system deps for Postgres TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml ./
# If a lockfile exists, copy it for better caching
COPY Cargo.lock* ./

RUN cargo fetch

# Build
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/backend /app/backend

EXPOSE 3000

CMD ["/app/backend"]
