"use strict";

const Botkit = require("botkit");
const AzureDevops = require("azure-devops-node-api");

// Slack bot
const controller = Botkit.slackbot({debug: !!process.env.DEBUG});
const bot = controller.spawn({
    incoming_webhook: {
        url: process.env.SLACK_INCOMING_WEBHOOK
    }
});

// Azure DevOps connection
const orgUrl = `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORGANIZATION}`;
const authHandler = AzureDevops.getPersonalAccessTokenHandler(
    process.env.AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN);
const connection = new AzureDevops.WebApi(orgUrl, authHandler);

// Load pull-requests
async function getAllPullRequests() {
    const git = await connection.getGitApi();
    const prs = await git.getPullRequestsByProject(
        process.env.AZURE_DEVOPS_PROJECT);

    const threadRequests = prs.map(
        pr => git.getThreads(pr.repository.id, pr.pullRequestId));
    const threadsByPullRequest = await Promise.all(threadRequests);
    const activeComments = threadsByPullRequest.map(
        threads => threads.filter(
            thread => thread.status == 1 && !thread.isDeleted).length);

    const statuses = prs.map(pr => {
        if (pr.reviewers.some(r => r.vote == -10)) {
            return "Rejected";
        } else if (pr.reviewers.some(r => r.vote == -5)) {
            return "Waiting for author";
        } else if (pr.reviewers.some(r => r.vote == 5)) {
            return "Approved with suggestions";
        } else if (pr.reviewers.some(r => r.vote == 10)) {
            return "Approved";
        } else {
            return "No vote";
        }
    });

    return prs.map((pr, index) => ({
        title: pr.title,
        reviewers: pr.reviewers.map(r =>
            r.uniqueName.includes("@")
                ? r.uniqueName.split("@")[0]
                : r.uniqueName.split("\\").slice(-1)[0]),
        repository: pr.repository.name,
        url: `${orgUrl}/${pr.repository.project.name}/_git/`
            + `${pr.repository.name}/pullrequest/${pr.pullRequestId}`,
        author: pr.createdBy.displayName,
        creationDate: new Date(pr.creationDate),
        source: pr.sourceRefName.replace(/^refs\/heads\//, ""),
        target: pr.targetRefName.replace(/^refs\/heads\//, ""),
        status: statuses[index],
        activeComments: activeComments[index]
    }));
}

// Format and print pull requests
getAllPullRequests().then((prs) => {
    const now = new Date();
    const attachments = prs.map(pr => {
        // Yellow when older than a day, red when older than a week.
        const dangerThreshold = 7 * 24 * 60 * 60 * 1000;
        const warningThreshold = 1 * 24 * 60 * 60 * 1000;

        const age = now - pr.creationDate;
        let color;
        if (age > dangerThreshold) {
            color = "danger";
        } else if (age > warningThreshold) {
            color = "warning";
        } else {
            color = "good";
        }

        return {
            fallback: `${pr.title} by ${pr.author}`,
            color: color,
            title: pr.title,
            title_link: pr.url,
            fields: [
                {
                    title: "Author",
                    value: pr.author,
                    short: true
                },
                {
                    title: "Repository",
                    value: pr.repository,
                    short: true
                },
                {
                    title: "Branch",
                    value: `\`${pr.source}\` into \`${pr.target}\``
                },
                {
                    title: "Status",
                    value: pr.activeComments > 0 ? `${pr.status} (${pr.activeComments} unresolved comments)` : pr.status
                }

            ],
            mrkdwn_in: ["fields"],
            ts: Math.round(pr.creationDate / 1000)
        };
    });

    bot.sendWebhook({
        text: "Open pull requests",
        attachments: attachments,
    }, (err, res) => {
        if (err) {
            console.error(err);
        }
    });

    console.log(`Reminded about ${attachments.length} pull requests.`)
}).catch((err) => {
    console.error(err);
});
