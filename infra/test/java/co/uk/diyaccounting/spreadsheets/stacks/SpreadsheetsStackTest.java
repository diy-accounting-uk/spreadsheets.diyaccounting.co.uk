// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

package co.uk.diyaccounting.spreadsheets.stacks;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

class SpreadsheetsStackTest {

    private static final List<String> PROD_DOMAIN_NAMES =
            List.of("spreadsheets.diyaccounting.co.uk", "prod-spreadsheets.diyaccounting.co.uk");
    private static final List<String> CI_DOMAIN_NAMES = List.of("ci-spreadsheets.diyaccounting.co.uk");

    private static Path writeDocRoot(Path tempDir) throws IOException {
        Path publicDir = tempDir.resolve("public");
        Files.createDirectories(publicDir);
        Files.writeString(publicDir.resolve("index.html"), "<html></html>");
        return publicDir;
    }

    private static Template synth(String envName, Path publicDir, List<String> domainNames) {
        App app = new App();
        SpreadsheetsStack stack = new SpreadsheetsStack(
                app,
                "Test" + envName + "SpreadsheetsStack",
                SpreadsheetsStack.SpreadsheetsStackProps.builder()
                        .env(Environment.builder()
                                .account("064390746177")
                                .region("us-east-1")
                                .build())
                        .envName(envName)
                        .certificateArn("arn:aws:acm:us-east-1:064390746177:certificate/placeholder")
                        .docRootPath(publicDir.toString())
                        .domainNames(domainNames)
                        .build());
        return Template.fromStack(stack);
    }

    @SuppressWarnings("unchecked")
    private static String contentSecurityPolicyFrom(Template template) {
        Map<String, Map<String, Object>> policies = template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
        Map<String, Object> policy = policies.values().iterator().next();
        Map<String, Object> properties = (Map<String, Object>) policy.get("Properties");
        Map<String, Object> config = (Map<String, Object>) properties.get("ResponseHeadersPolicyConfig");
        Map<String, Object> securityHeadersConfig = (Map<String, Object>) config.get("SecurityHeadersConfig");
        Map<String, Object> csp = (Map<String, Object>) securityHeadersConfig.get("ContentSecurityPolicy");
        return (String) csp.get("ContentSecurityPolicy");
    }

    @Test
    void appMonitorIsNamedPerEnvironmentAndCarriesPerformanceTelemetry(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);

        Template prodTemplate = synth("prod", publicDir, PROD_DOMAIN_NAMES);
        prodTemplate.resourceCountIs("AWS::RUM::AppMonitor", 1);
        prodTemplate.hasResourceProperties(
                "AWS::RUM::AppMonitor",
                Match.objectLike(Map.of(
                        "Name",
                        "spreadsheets-web",
                        "AppMonitorConfiguration",
                        Match.objectLike(Map.of("Telemetries", Match.arrayWith(List.of("performance")))))));

        Template ciTemplate = synth("ci", publicDir, CI_DOMAIN_NAMES);
        ciTemplate.resourceCountIs("AWS::RUM::AppMonitor", 1);
        ciTemplate.hasResourceProperties(
                "AWS::RUM::AppMonitor",
                Match.objectLike(Map.of(
                        "Name",
                        "ci-spreadsheets-web",
                        "AppMonitorConfiguration",
                        Match.objectLike(Map.of("Telemetries", Match.arrayWith(List.of("performance")))))));
    }

    @Test
    void identityPoolAllowsUnauthenticatedIdentities(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        template.resourceCountIs("AWS::Cognito::IdentityPool", 1);
        template.hasResourceProperties(
                "AWS::Cognito::IdentityPool", Match.objectLike(Map.of("AllowUnauthenticatedIdentities", true)));
    }

    @Test
    void guestRolePolicyCarriesPutRumEvents(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        Map<String, Map<String, Object>> policies = template.findResources(
                "AWS::IAM::Policy",
                Match.objectLike(Map.of(
                        "Properties",
                        Match.objectLike(Map.of(
                                "PolicyDocument",
                                Match.objectLike(Map.of(
                                        "Statement",
                                        Match.arrayWith(
                                                List.of(Match.objectLike(Map.of("Action", "rum:PutRumEvents")))))))))));
        assertTrue(!policies.isEmpty(), "expected an IAM policy carrying rum:PutRumEvents");
    }

    @Test
    void contentSecurityPolicyCoversTheRumDataplane(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        String contentSecurityPolicy = contentSecurityPolicyFrom(template);

        assertTrue(contentSecurityPolicy.contains("dataplane.rum.us-east-1.amazonaws.com"));
    }

    @Test
    void docRootSyncLeavesTheRumConfigToTheRumDeployment(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        template.hasResourceProperties(
                "Custom::CDKBucketDeployment", Match.objectLike(Map.of("Exclude", List.of("lib/rum-config.js"))));
        template.hasResourceProperties(
                "Custom::CDKBucketDeployment",
                Match.objectLike(Map.of("DistributionPaths", List.of("/lib/rum-config.js"))));
    }
}
