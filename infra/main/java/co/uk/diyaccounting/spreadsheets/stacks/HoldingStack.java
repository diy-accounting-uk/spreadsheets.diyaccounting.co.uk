/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 DIY Accounting Ltd
 */

package co.uk.diyaccounting.spreadsheets.stacks;

import static co.uk.diyaccounting.spreadsheets.utils.Kind.infof;
import static co.uk.diyaccounting.spreadsheets.utils.KindCdk.cfnOutput;
import static co.uk.diyaccounting.spreadsheets.utils.KindCdk.ensureLogGroupWithDependency;

import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import org.immutables.value.Value;
import software.amazon.awscdk.ArnComponents;
import software.amazon.awscdk.AssetHashType;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Tags;
import software.amazon.awscdk.services.certificatemanager.Certificate;
import software.amazon.awscdk.services.cloudfront.AllowedMethods;
import software.amazon.awscdk.services.cloudfront.BehaviorOptions;
import software.amazon.awscdk.services.cloudfront.Distribution;
import software.amazon.awscdk.services.cloudfront.ErrorResponse;
import software.amazon.awscdk.services.cloudfront.HeadersFrameOption;
import software.amazon.awscdk.services.cloudfront.IOrigin;
import software.amazon.awscdk.services.cloudfront.OriginRequestPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseCustomHeader;
import software.amazon.awscdk.services.cloudfront.ResponseCustomHeadersBehavior;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersContentSecurityPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersContentTypeOptions;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersFrameOptions;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersReferrerPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersStrictTransportSecurity;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersXSSProtection;
import software.amazon.awscdk.services.cloudfront.ResponseSecurityHeadersBehavior;
import software.amazon.awscdk.services.cloudfront.S3OriginAccessControl;
import software.amazon.awscdk.services.cloudfront.SSLMethod;
import software.amazon.awscdk.services.cloudfront.Signing;
import software.amazon.awscdk.services.cloudfront.ViewerProtocolPolicy;
import software.amazon.awscdk.services.cloudfront.origins.S3BucketOrigin;
import software.amazon.awscdk.services.cloudfront.origins.S3BucketOriginWithOACProps;
import software.amazon.awscdk.services.iam.PolicyStatement;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.logs.CfnDelivery;
import software.amazon.awscdk.services.logs.CfnDeliveryDestination;
import software.amazon.awscdk.services.logs.CfnDeliveryDestinationProps;
import software.amazon.awscdk.services.logs.CfnDeliveryProps;
import software.amazon.awscdk.services.logs.CfnDeliverySource;
import software.amazon.awscdk.services.logs.CfnDeliverySourceProps;
import software.amazon.awscdk.services.logs.ILogGroup;
import software.amazon.awscdk.services.s3.BlockPublicAccess;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.BucketEncryption;
import software.amazon.awscdk.services.s3.assets.AssetOptions;
import software.amazon.awscdk.services.s3.deployment.BucketDeployment;
import software.amazon.awscdk.services.s3.deployment.Source;
import software.constructs.Construct;

/**
 * HoldingStack: S3 + CloudFront serving a single static maintenance page for
 * spreadsheets.diyaccounting.co.uk failover.
 * <p>
 * The certificate is imported by ARN rather than issued in-stack: this account cannot resolve
 * the management account's hosted zone, so CertificateValidation.fromDns(zone) would deadlock
 * CloudFormation waiting on a validation CNAME CDK has no way to write. The ARN is issued once
 * by a separate bootstrap workflow (request-holding-cert.yml) and its SAN list covers the live
 * domain names as well as the holding domain, because failover adds the live alias to this
 * distribution and CloudFront rejects an alias the certificate does not cover.
 * <p>
 * No Route53 record is created here — the holding A/AAAA records live in the root account and
 * are managed by root.diyaccounting.co.uk's RootDnsStack.
 */
public class HoldingStack extends Stack {

    public final Bucket holdingBucket;
    public final Distribution distribution;
    public final BucketDeployment holdingDeployment;

    @Value.Immutable
    public interface HoldingStackProps extends StackProps {
        @Override
        Environment getEnv();

        @Override
        @Value.Default
        default Boolean getCrossRegionReferences() {
            return false;
        }

        String envName();

        String certificateArn();

        String holdingDocRootPath();

        /** Fully qualified holding domain, e.g. holding.spreadsheets.diyaccounting.co.uk */
        String holdingDomainName();

        static ImmutableHoldingStackProps.Builder builder() {
            return ImmutableHoldingStackProps.builder();
        }
    }

    public HoldingStack(final Construct scope, final String id, final HoldingStackProps props) {
        super(scope, id, StackProps.builder().env(props.getEnv()).build());

        String resourcePrefix = props.envName() + "-spreadsheets-holding";

        // Apply cost allocation tags
        Tags.of(this).add("Environment", props.envName());
        Tags.of(this).add("Application", "@diy-accounting-uk/spreadsheets.diyaccounting.co.uk/spreadsheets");
        Tags.of(this).add("CostCenter", "@diy-accounting-uk/spreadsheets.diyaccounting.co.uk");
        Tags.of(this).add("Owner", "@diy-accounting-uk/spreadsheets.diyaccounting.co.uk");
        Tags.of(this).add("Project", "@diy-accounting-uk/spreadsheets.diyaccounting.co.uk");
        Tags.of(this).add("Stack", "HoldingStack");
        Tags.of(this).add("ManagedBy", "aws-cdk");
        Tags.of(this).add("BillingPurpose", "spreadsheets-holding-page");
        Tags.of(this).add("ResourceType", "static-site");
        Tags.of(this).add("Criticality", "low");
        Tags.of(this).add("DataClassification", "public");
        Tags.of(this).add("BackupRequired", "false");
        Tags.of(this).add("MonitoringEnabled", "true");

        // TLS certificate from existing ACM (must be in us-east-1 for CloudFront)
        var cert = Certificate.fromCertificateArn(this, resourcePrefix + "-HoldingCert", props.certificateArn());

        // S3 origin bucket — no explicit bucketName so each account gets a unique name
        // (S3 bucket names are globally unique; hardcoding causes collisions during account migration)
        this.holdingBucket = Bucket.Builder.create(this, resourcePrefix + "-OriginBucket")
                .versioned(false)
                .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
                .encryption(BucketEncryption.S3_MANAGED)
                .removalPolicy(RemovalPolicy.DESTROY)
                .autoDeleteObjects(true)
                .build();
        infof("Created holding bucket %s", this.holdingBucket.getBucketName());

        this.holdingBucket.addToResourcePolicy(PolicyStatement.Builder.create()
                .sid("AllowCloudFrontReadViaOAC")
                .principals(List.of(new ServicePrincipal("cloudfront.amazonaws.com")))
                .actions(List.of("s3:GetObject"))
                .resources(List.of(this.holdingBucket.getBucketArn() + "/*"))
                .conditions(Map.of(
                        "StringEquals",
                        Map.of("AWS:SourceAccount", this.getAccount()),
                        "ArnLike",
                        Map.of("AWS:SourceArn", "arn:aws:cloudfront::" + this.getAccount() + ":distribution/*")))
                .build());

        S3OriginAccessControl oac = S3OriginAccessControl.Builder.create(this, resourcePrefix + "-OAC")
                .signing(Signing.SIGV4_ALWAYS)
                .build();
        IOrigin origin = S3BucketOrigin.withOriginAccessControl(
                this.holdingBucket,
                S3BucketOriginWithOACProps.builder().originAccessControl(oac).build());

        // Response headers policy: minimal CSP, the holding page is a single self-contained HTML file
        ResponseHeadersPolicy responseHeadersPolicy = ResponseHeadersPolicy.Builder.create(
                        this, resourcePrefix + "-HeadersPolicy")
                .responseHeadersPolicyName(resourcePrefix + "-whp")
                .comment("Security headers for spreadsheets holding page")
                .securityHeadersBehavior(ResponseSecurityHeadersBehavior.builder()
                        .contentSecurityPolicy(ResponseHeadersContentSecurityPolicy.builder()
                                .contentSecurityPolicy("default-src 'self'; style-src 'self' 'unsafe-inline'; "
                                        + "img-src 'self' data:; frame-ancestors 'none'; form-action 'none';")
                                .override(true)
                                .build())
                        .strictTransportSecurity(ResponseHeadersStrictTransportSecurity.builder()
                                .accessControlMaxAge(Duration.days(365))
                                .includeSubdomains(true)
                                .override(true)
                                .build())
                        .contentTypeOptions(ResponseHeadersContentTypeOptions.builder()
                                .override(true)
                                .build())
                        .frameOptions(ResponseHeadersFrameOptions.builder()
                                .frameOption(HeadersFrameOption.DENY)
                                .override(true)
                                .build())
                        .referrerPolicy(ResponseHeadersReferrerPolicy.builder()
                                .referrerPolicy(
                                        software.amazon.awscdk.services.cloudfront.HeadersReferrerPolicy
                                                .STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                                .override(true)
                                .build())
                        .xssProtection(ResponseHeadersXSSProtection.builder()
                                .protection(true)
                                .modeBlock(true)
                                .override(true)
                                .build())
                        .build())
                .customHeadersBehavior(ResponseCustomHeadersBehavior.builder()
                        .customHeaders(List.of(ResponseCustomHeader.builder()
                                .header("Server")
                                .value("DIY-Accounting")
                                .override(true)
                                .build()))
                        .build())
                .build();

        BehaviorOptions defaultBehavior = BehaviorOptions.builder()
                .origin(origin)
                .allowedMethods(AllowedMethods.ALLOW_GET_HEAD_OPTIONS)
                .originRequestPolicy(OriginRequestPolicy.CORS_S3_ORIGIN)
                .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
                .responseHeadersPolicy(responseHeadersPolicy)
                .compress(true)
                .build();

        // CloudFront distribution — errorResponses map 403/404 to the holding page because during
        // failover requests arrive on every path the live site ever published, and this
        // distribution has exactly one S3 origin and no API behaviours, so that is safe here.
        this.distribution = Distribution.Builder.create(this, resourcePrefix + "-Distribution")
                .defaultBehavior(defaultBehavior)
                .domainNames(List.of(props.holdingDomainName()))
                .certificate(cert)
                .defaultRootObject("index.html")
                .enableLogging(false)
                .enableIpv6(true)
                .sslSupportMethod(SSLMethod.SNI)
                .errorResponses(List.of(
                        ErrorResponse.builder()
                                .httpStatus(403)
                                .responseHttpStatus(200)
                                .responsePagePath("/index.html")
                                .ttl(Duration.seconds(0))
                                .build(),
                        ErrorResponse.builder()
                                .httpStatus(404)
                                .responseHttpStatus(200)
                                .responsePagePath("/index.html")
                                .ttl(Duration.seconds(0))
                                .build()))
                .build();
        Tags.of(this.distribution).add("OriginFor", props.holdingDomainName());

        // CloudFront access logging to CloudWatch Logs
        String logGroupName = "distribution-" + resourcePrefix + "-logs";
        ILogGroup accessLogGroup = ensureLogGroupWithDependency(this, resourcePrefix + "-AccessLogGroup", logGroupName)
                .logGroup();

        String distributionArn = Stack.of(this)
                .formatArn(ArnComponents.builder()
                        .service("cloudfront")
                        .region("")
                        .resource("distribution")
                        .resourceName(this.distribution.getDistributionId())
                        .build());

        String deliverySourceName = resourcePrefix + "-dist-src";
        String deliveryDestName = resourcePrefix + "-logs-dest";

        CfnDeliveryDestination logsDestination = new CfnDeliveryDestination(
                this,
                resourcePrefix + "-LogsDestination",
                CfnDeliveryDestinationProps.builder()
                        .name(deliveryDestName)
                        .destinationResourceArn(accessLogGroup.getLogGroupArn())
                        .outputFormat("json")
                        .build());

        CfnDeliverySource logsSource = new CfnDeliverySource(
                this,
                resourcePrefix + "-LogsSource",
                CfnDeliverySourceProps.builder()
                        .name(deliverySourceName)
                        .logType("ACCESS_LOGS")
                        .resourceArn(distributionArn)
                        .build());

        CfnDelivery logsDelivery = new CfnDelivery(
                this,
                resourcePrefix + "-LogsDelivery",
                CfnDeliveryProps.builder()
                        .deliverySourceName(deliverySourceName)
                        .deliveryDestinationArn(logsDestination.getAttrArn())
                        .build());
        logsDelivery.addDependency(logsSource);

        // Deploy the holding page to S3 and invalidate the distribution.
        // prune(true) here (unlike SpreadsheetsStack's prune(false)) because nothing else writes
        // to the holding bucket.
        var holdingDocRoot = Paths.get(props.holdingDocRootPath())
                .toAbsolutePath()
                .normalize()
                .toString();
        infof("Using holding doc root: %s".formatted(holdingDocRoot));
        var holdingDocRootSource = Source.asset(
                holdingDocRoot,
                AssetOptions.builder().assetHashType(AssetHashType.SOURCE).build());
        this.holdingDeployment = BucketDeployment.Builder.create(this, resourcePrefix + "-DeployHoldingContent")
                .sources(List.of(holdingDocRootSource))
                .destinationBucket(this.holdingBucket)
                .distribution(distribution)
                .distributionPaths(List.of("/index.html"))
                .retainOnDelete(false)
                .prune(true)
                .build();

        // Outputs
        cfnOutput(this, "DistributionDomainName", this.distribution.getDomainName());
        cfnOutput(this, "DistributionId", this.distribution.getDistributionId());
        cfnOutput(this, "HoldingBucketName", this.holdingBucket.getBucketName());
        cfnOutput(this, "HoldingDomainName", props.holdingDomainName());

        infof("HoldingStack %s created for %s", this.getNode().getId(), props.holdingDomainName());
    }
}
