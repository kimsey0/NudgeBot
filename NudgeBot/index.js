"use strict";

const Botkit = require("botkit");
const AzureDevops = require("azure-devops-node-api");

module.exports = async function (context, myTimer) {
    // Slack bot
    const controller = Botkit.slackbot();
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
    const git = await connection.getGitApi();

    for (let project of process.env.AZURE_DEVOPS_PROJECT.split(",")) {
        // Load pull-requests
        const rawPullRequests = await git.getPullRequestsByProject(project);

        const threadRequests = rawPullRequests.map(
            pr => git.getThreads(pr.repository.id, pr.pullRequestId));
        const threadsByPullRequest = await Promise.all(threadRequests);
        const activeComments = threadsByPullRequest.map(
            threads => threads.filter(
                thread => thread.status == 1 && !thread.isDeleted).length);

        const statuses = rawPullRequests.map(pr => {
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

        const pullRequests = rawPullRequests.map((pr, index) => ({
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

        // Format and print pull requests
        const now = new Date();
        const attachments = pullRequests.map(pr => {
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

            let status;
            if (pr.activeComments > 1) {
                status = `${pr.status} (${pr.activeComments} unresolved comments)`;
            } else if (pr.activeComments == 1) {
                status = `${pr.status} (${pr.activeComments} unresolved comment)`;
            } else {
                status = pr.status;
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
                        value: status
                    }

                ],
                mrkdwn_in: ["fields"],
                ts: Math.round(pr.creationDate / 1000)
            };
        });

        bot.sendWebhook({
            text: `Open pull requests in ${project}`,
            attachments: attachments,
        }, (err, res) => {
            if (err) {
                context.error(err);
            }
        });

        context.log(`Reminded about ${attachments.length} pull requests in ${project}.`);
    }
};