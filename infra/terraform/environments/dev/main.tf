provider "aws" {
  region = var.aws_region
}

terraform {
  backend "s3" {
    bucket         = "codepad-terraform-state"
    key            = "environments/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "codepad-terraform-lock"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "codepad"
}

variable "environment" {
  type    = string
  default = "dev"
}

# ─── VPC ───────────────────────────────────────────────────
module "vpc" {
  source      = "../../modules/vpc"
  project     = var.project
  environment = var.environment
  vpc_cidr    = "10.10.0.0/16"
}

# ─── EKS ───────────────────────────────────────────────────
module "eks" {
  source             = "../../modules/eks"
  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  node_instance_type = "t3.medium"
  node_count         = 2
}

# ─── RDS ───────────────────────────────────────────────────
module "rds" {
  source         = "../../modules/rds"
  project        = var.project
  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  instance_class = "db.t3.micro"
}

# ─── Redis ─────────────────────────────────────────────────
module "redis" {
  source      = "../../modules/redis"
  project     = var.project
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  node_type   = "cache.t3.micro"
}

# ─── S3 ────────────────────────────────────────────────────
module "s3" {
  source      = "../../modules/s3"
  project     = var.project
  environment = var.environment
}

# ─── IAM (IRSA) ───────────────────────────────────────────
module "iam" {
  source               = "../../modules/iam"
  project              = var.project
  environment          = var.environment
  cluster_name         = module.eks.cluster_name
  oidc_provider_url    = module.eks.oidc_provider_url
  oidc_provider_arn    = module.eks.oidc_provider_arn
  snapshot_bucket_arn  = module.s3.snapshot_bucket_arn
  recording_bucket_arn = module.s3.recording_bucket_arn
}

output "database_url" {
  value     = module.rds.database_url
  sensitive = true
}

output "redis_url" {
  value = module.redis.redis_url
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}
