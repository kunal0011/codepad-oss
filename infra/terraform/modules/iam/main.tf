variable "project" {
  type    = string
  default = "codepad"
}

variable "environment" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "oidc_provider_url" {
  type = string
}

variable "oidc_provider_arn" {
  type = string
}

variable "snapshot_bucket_arn" {
  type = string
}

variable "recording_bucket_arn" {
  type = string
}

locals {
  oidc_url = replace(var.oidc_provider_url, "https://", "")
}

resource "aws_iam_role" "app_irsa" {
  name = "${var.project}-${var.environment}-app-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${local.oidc_url}:sub": "system:serviceaccount:default:codepad-app"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "app_s3_policy" {
  name        = "${var.project}-${var.environment}-app-s3-policy"
  description = "Policy for app access to S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Effect   = "Allow"
        Resource = [
          var.snapshot_bucket_arn,
          "${var.snapshot_bucket_arn}/*",
          var.recording_bucket_arn,
          "${var.recording_bucket_arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_s3" {
  role       = aws_iam_role.app_irsa.name
  policy_arn = aws_iam_policy.app_s3_policy.arn
}

output "app_role_arn" {
  value = aws_iam_role.app_irsa.arn
}
