output "backend_alb_dns" {
  description = "DNS name of the backend ALB"
  value       = aws_lb.backend.dns_name
}

output "media_cloudfront_domain" {
  description = "CloudFront domain for media"
  value       = aws_cloudfront_distribution.media.domain_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.medusa.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "vpc_id" {
  value = aws_vpc.main.id
}
