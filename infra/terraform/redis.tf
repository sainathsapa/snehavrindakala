# ElastiCache Redis for Medusa workflow/cache.
# `aws_subnet_group` is not an AWS provider resource — it must be
# `aws_elasticache_subnet_group`, which is what the replication group below
# expects. This was the reason `terraform validate` never passed.
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.environment}-snehavrinda-redis-subnet-group"
  subnet_ids  = aws_subnet.private[*].id
  description = "Subnet group for Redis"
}

resource "aws_security_group" "redis" {
  name        = "${var.environment}-snehavrinda-redis-sg"
  description = "Allow Redis access from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-snehavrinda-redis-sg"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.environment}-snehavrinda-redis"
  # The provider argument is `description`, not `replication_group_description`.
  # (The old name was silently rejected — validate is what surfaced it.)
  description                = "Redis for Medusa workflow and cache"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.t3.micro"
  automatic_failover_enabled = var.enable_multi_az
  num_cache_clusters         = var.enable_multi_az ? 2 : 1
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  transit_encryption_enabled = false
  at_rest_encryption_enabled = true
  snapshot_retention_limit   = 7
  snapshot_window            = "03:00-04:00"

  tags = {
    Environment = var.environment
  }
}
