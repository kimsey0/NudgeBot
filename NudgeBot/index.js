"use strict";

const { IncomingWebhook } = require('@slack/webhook');
const AzureDevops = require("azure-devops-node-api");
const getPullRequests = require("./getPullRequests");
const formatPullRequests = require("./formatPullRequests");
const getForbiddenAndInactiveBranches = require("./getForbiddenAndInactiveBranches");
const postToWebhook = require("./postToWebhook");

module.exports = async function (context, myTimer) {
    // Slack webhook
    const webhook = new IncomingWebhook(process.env.SLACK_INCOMING_WEBHOOK);

    // Azure DevOps connection
    const orgUrl = `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORGANIZATION}`;
    const authHandler = AzureDevops.getPersonalAccessTokenHandler(
        process.env.AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN);
    const connection = new AzureDevops.WebApi(orgUrl, authHandler);
    const git = await connection.getGitApi();

    const now = new Date();

    for (const project of process.env.AZURE_DEVOPS_PROJECT.split(",")) {
        const pullRequests = await getPullRequests(git, project);

        const pullRequestAttachments = formatPullRequests(pullRequests, now);
        await postToWebhook(context, webhook, project, "pull requests", pullRequestAttachments);
        
        const {forbiddenBranches, inactiveBranches} = await getForbiddenAndInactiveBranches(git, project, pullRequests, now);

        const forbiddenBranchAttachments = forbiddenBranches.map(info => ({
            text: `\`${info.branch}\` in \`${info.repository}\``,
            color: "danger",
            mrkdwn_in: ["text"]
        }));
        await postToWebhook(context, webhook, project, "forbidden branches", forbiddenBranchAttachments);

        const dangerThreshold = process.env.BRANCH_AGE_DANGER || 30 * 24;
        const inactiveBranchAttachments = inactiveBranches.map(info => ({
            text: `\`${info.branch}\` in \`${info.repository}\``,
            color: info.age > dangerThreshold ? "danger" : "warning",
            mrkdwn_in: ["text"]
        }));
        await postToWebhook(context, webhook, project, "inactive branches", inactiveBranchAttachments);
    }
};