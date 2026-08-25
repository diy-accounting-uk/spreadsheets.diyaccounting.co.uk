/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2025-2026 DIY Accounting Ltd
 */

package co.uk.diyaccounting.spreadsheets;

import static co.uk.diyaccounting.spreadsheets.utils.Kind.envOr;
import static co.uk.diyaccounting.spreadsheets.utils.Kind.infof;

import co.uk.diyaccounting.spreadsheets.stacks.HoldingStack;
import co.uk.diyaccounting.spreadsheets.stacks.SpreadsheetsStack;
import co.uk.diyaccounting.spreadsheets.utils.KindCdk;
import java.util.ArrayList;
import java.util.List;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;

/**
 * CDK entry point for the spreadsheets site. Deploys a single SpreadsheetsStack
 * containing S3 + CloudFront for the spreadsheets.diyaccounting.co.uk static site.
 * <p>
 * No Route53 records are created here — those live in the root account
 * and are managed by the root.diyaccounting.co.uk repository.
 */
public class SpreadsheetsEnvironment {

    public final SpreadsheetsStack spreadsheetsStack;
    public final HoldingStack holdingStack;

    public static void main(final String[] args) {
        App app = new App();

        var envName = envOr("ENVIRONMENT_NAME", KindCdk.getContextValueString(app, "envName", "ci"));
        var certificateArn = envOr("CERTIFICATE_ARN", KindCdk.getContextValueString(app, "certificateArn", ""));
        var docRootPath = envOr(
                "DOC_ROOT_PATH",
                KindCdk.getContextValueString(app, "docRootPath", "../web/spreadsheets.diyaccounting.co.uk/public"));
        var domainNamesStr = envOr("DOMAIN_NAMES", KindCdk.getContextValueString(app, "domainNames", ""));
        var prodFQDomainName = KindCdk.getContextValueString(app, "prodFQDomainName", "");

        List<String> domainNames;
        if (!domainNamesStr.isBlank()) {
            domainNames = List.of(domainNamesStr.split(","));
        } else {
            var names = new ArrayList<String>();
            names.add(envName + "-spreadsheets.diyaccounting.co.uk");
            if ("prod".equals(envName) && !prodFQDomainName.isBlank()) {
                names.add(prodFQDomainName);
            }
            domainNames = List.copyOf(names);
        }

        var holdingCertificateArn =
                envOr("HOLDING_CERTIFICATE_ARN", KindCdk.getContextValueString(app, "holdingCertificateArn", ""));
        var holdingDocRootPath = envOr(
                "HOLDING_DOC_ROOT_PATH",
                KindCdk.getContextValueString(
                        app, "holdingDocRootPath", "../web/spreadsheets.diyaccounting.co.uk/holding"));
        var holdingDomainName =
                envOr("HOLDING_DOMAIN_NAME", KindCdk.getContextValueString(app, "holdingDomainName", ""));
        if (holdingDomainName.isBlank()) {
            holdingDomainName = "prod".equals(envName)
                    ? "holding.spreadsheets.diyaccounting.co.uk"
                    : envName + "-holding.spreadsheets.diyaccounting.co.uk";
        }

        var spreadsheets = new SpreadsheetsEnvironment(
                app,
                envName,
                certificateArn,
                docRootPath,
                domainNames,
                holdingCertificateArn,
                holdingDocRootPath,
                holdingDomainName);
        app.synth();
        infof("CDK synth complete for spreadsheets environment");
    }

    public SpreadsheetsEnvironment(
            App app,
            String envName,
            String certificateArn,
            String docRootPath,
            List<String> domainNames,
            String holdingCertificateArn,
            String holdingDocRootPath,
            String holdingDomainName) {
        // CloudFront requires us-east-1 for certificates
        Environment usEast1Env = Environment.builder()
                .region("us-east-1")
                .account(KindCdk.buildPrimaryEnvironment().getAccount())
                .build();

        String stackId = envName + "-spreadsheets-SpreadsheetsStack";
        infof("Synthesizing stack %s for environment %s", stackId, envName);

        this.spreadsheetsStack = new SpreadsheetsStack(
                app,
                stackId,
                SpreadsheetsStack.SpreadsheetsStackProps.builder()
                        .env(usEast1Env)
                        .envName(envName)
                        .certificateArn(certificateArn)
                        .docRootPath(docRootPath)
                        .domainNames(domainNames)
                        .build());

        // Skipped rather than synthesized with an invalid certificate until the holding
        // certificate exists: request-holding-cert.yml issues it once, ahead of this stack's
        // first deploy, and until then Distribution.Builder rejects a blank certificate ARN.
        if (!holdingCertificateArn.isBlank()) {
            String holdingStackId = envName + "-spreadsheets-HoldingStack";
            infof("Synthesizing stack %s for environment %s", holdingStackId, envName);

            this.holdingStack = new HoldingStack(
                    app,
                    holdingStackId,
                    HoldingStack.HoldingStackProps.builder()
                            .env(usEast1Env)
                            .envName(envName)
                            .certificateArn(holdingCertificateArn)
                            .holdingDocRootPath(holdingDocRootPath)
                            .holdingDomainName(holdingDomainName)
                            .build());
        } else {
            infof("holdingCertificateArn is blank, skipping HoldingStack for environment %s", envName);
            this.holdingStack = null;
        }
    }
}
