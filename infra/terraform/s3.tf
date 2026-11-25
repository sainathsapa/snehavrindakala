# S3 buckets for media storage
resource "aws_s3_bucket" "public_media" {
  bucket = "${var.environment}-snehavrinda-public-media"
  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "public_media" {
  bucket                  = aws_s3_bucket.public_media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "private_uploads" {
  bucket = "${var.environment}-snehavrinda-private-uploads"
  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "private_uploads" {
  bucket                  = aws_s3_bucket.private_uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront for public media
resource "aws_cloudfront_origin_access_control" "s3_origin" {
  name                              = "${var.environment}-snehavrinda-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_protocol                  = "sigv4"
  signing_behavior                  = "never"
}

resource "aws_cloudfront_distribution" "media" {
  origin {
    domain_name = aws_s3_bucket.public_media.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.public_media.id}"
    # `origin_access_control` is a distribution-origin argument, not something
    # nested inside s3_origin_config — the old shape made validate fail.
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_origin.id
  }
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.cloudfront_domain]

  default_cache_behavior {
    target_origin_id       = "S3-${aws_s3_bucket.public_media.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Required by the provider. Without it validate fails, and `aliases` cannot be
  # served over TLS without a certificate. Uses the same ACM certificate as the
  # ALB so there is one certificate to renew and one expiry to monitor.
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Environment = var.environment
  }
}

variable "cloudfront_domain" {
  description = "CloudFront domain name (optional)"
  type        = string
  default     = ""
}
