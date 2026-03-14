variable "project" {
  type    = string
  default = "codepad"
}

variable "environment" {
  type = string
}

resource "aws_prometheus_workspace" "main" {
  alias = "${var.project}-${var.environment}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "loki_replacement" {
  name              = "/aws/containerinsights/${var.project}-${var.environment}/application"
  retention_in_days = var.environment == "prod" ? 30 : 7
}

output "prometheus_endpoint" {
  value = aws_prometheus_workspace.main.prometheus_endpoint
}
