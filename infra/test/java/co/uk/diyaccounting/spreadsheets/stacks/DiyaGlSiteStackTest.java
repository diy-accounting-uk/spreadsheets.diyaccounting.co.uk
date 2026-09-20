// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

package co.uk.diyaccounting.spreadsheets.stacks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

class DiyaGlSiteStackTest {

    private static final List<String> PROD_DOMAIN_NAMES =
            List.of("diya-gl.co.uk", "www.diya-gl.co.uk", "diya-gl.com", "www.diya-gl.com");
    private static final List<String> CI_DOMAIN_NAMES = List.of("ci.diya-gl.co.uk", "ci.diya-gl.com");

    private static Path writeDocRoot(Path tempDir) throws IOException {
        Path publicDir = tempDir.resolve("public");
        Files.createDirectories(publicDir);
        Files.writeString(publicDir.resolve("index.html"), "<html></html>");
        Files.writeString(tempDir.resolve("redirect-function.js"), "function handler(event) { return event.request; }");
        return publicDir;
    }

    private static Template synth(String envName, Path publicDir, List<String> domainNames) {
        App app = new App();
        DiyaGlSiteStack stack = new DiyaGlSiteStack(
                app,
                "Test" + envName + "DiyaGlSiteStack",
                DiyaGlSiteStack.DiyaGlSiteStackProps.builder()
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
    void distributionAliasesMatchDomainNamesPerEnvironment(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);

        Template prodTemplate = synth("prod", publicDir, PROD_DOMAIN_NAMES);
        prodTemplate.hasResourceProperties(
                "AWS::CloudFront::Distribution",
                Match.objectLike(Map.of("DistributionConfig", Match.objectLike(Map.of("Aliases", PROD_DOMAIN_NAMES)))));

        Template ciTemplate = synth("ci", publicDir, CI_DOMAIN_NAMES);
        ciTemplate.hasResourceProperties(
                "AWS::CloudFront::Distribution",
                Match.objectLike(Map.of("DistributionConfig", Match.objectLike(Map.of("Aliases", CI_DOMAIN_NAMES)))));
    }

    @Test
    void securityHeadersPolicyAllowsSubmitAndExcludesPaypal(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        String contentSecurityPolicy = contentSecurityPolicyFrom(template);

        assertTrue(contentSecurityPolicy.contains("https://submit.diyaccounting.co.uk"));
        assertFalse(contentSecurityPolicy.toLowerCase(java.util.Locale.ROOT).contains("paypal"));
    }

    @Test
    void redirectFunctionAttachedExactlyOnce(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        template.resourceCountIs("AWS::CloudFront::Function", 1);
    }

    @Test
    void originBucketBlocksAllPublicAccess(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        var publicAccessBlock = Match.objectLike(Map.of(
                "BlockPublicAcls", true,
                "BlockPublicPolicy", true,
                "IgnorePublicAcls", true,
                "RestrictPublicBuckets", true));

        template.hasResourceProperties(
                "AWS::S3::Bucket", Match.objectLike(Map.of("PublicAccessBlockConfiguration", publicAccessBlock)));
    }

    @Test
    void outputsCarryEachOutputName(@TempDir Path tempDir) throws IOException {
        Path publicDir = writeDocRoot(tempDir);
        Template template = synth("ci", publicDir, CI_DOMAIN_NAMES);

        assertEquals(3, template.findOutputs("*", Match.anyValue()).size());
    }
}
