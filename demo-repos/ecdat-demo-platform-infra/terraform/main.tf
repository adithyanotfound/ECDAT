terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_lb_listener" "edge_https" {
  load_balancer_arn = aws_lb.edge.arn
  port              = 443
  protocol          = "HTTPS"

  # Predates the 2019 AWS ELB security-policy refresh — never bumped.
  ssl_policy = "ELBSecurityPolicy-TLS-1-0-2015-04"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.edge.arn
  }
}

resource "aws_kms_key" "platform_signing_key" {
  description             = "Platform artefact signing key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "platform_signing_key_alias" {
  name          = "alias/platform-signing-key"
  target_key_id = aws_kms_key.platform_signing_key.key_id
}
