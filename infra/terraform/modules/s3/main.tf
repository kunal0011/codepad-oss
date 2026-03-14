variable "project" {
  type    = string
  default = "codepad"
}

variable "environment" {
  type = string
}

resource "aws_s3_bucket" "snapshots" {
  bucket = "${var.project}-${var.environment}-snapshots"

  tags = {
    Name        = "${var.project}-${var.environment}-snapshots"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "snapshots" {
  bucket = aws_s3_bucket.snapshots.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "snapshots" {
  bucket = aws_s3_bucket.snapshots.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "recordings" {
  bucket = "${var.project}-${var.environment}-recordings"

  tags = {
    Name        = "${var.project}-${var.environment}-recordings"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "snapshot_bucket_name" {
  value = aws_s3_bucket.snapshots.id
}

output "snapshot_bucket_arn" {
  value = aws_s3_bucket.snapshots.arn
}

output "recording_bucket_name" {
  value = aws_s3_bucket.recordings.id
}

output "recording_bucket_arn" {
  value = aws_s3_bucket.recordings.arn
}
