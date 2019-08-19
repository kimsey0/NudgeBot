"use strict";

const { IncomingWebhook } = require('@slack/webhook');
const AzureDevops = require("azure-devops-node-api");
const calculateAge = require("./calculateAge");

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
        // Load pull-requests
        let rawPullRequests = await git.getPullRequestsByProject(project, {});

        // Show oldest pull-requests first
        rawPullRequests.reverse();

        if (!process.env.INCLUDE_DRAFT_PULL_REQUESTS) {
            rawPullRequests = rawPullRequests.filter(pr => !pr.isDraft);
        }

        const threadRequests = rawPullRequests.map(pr =>
            git.getThreads(pr.repository.id, pr.pullRequestId));
        const threadsByPullRequest = await Promise.all(threadRequests);
        const activeComments = threadsByPullRequest.map(threads =>
            threads.filter(thread =>
                thread.status == 1 && !thread.isDeleted).length);

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

        const useLastCommitDate = process.env.PULL_REQUEST_AGE_SINCE === "commit";
        let lastCommitByPullRequest;
        if (useLastCommitDate) {
            const lastCommitRequests = rawPullRequests.map(pr =>
                git.getCommit(pr.lastMergeSourceCommit.commitId, pr.repository.id));
            lastCommitByPullRequest = await Promise.all(lastCommitRequests);
        }

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
            activeComments: activeComments[index],
            lastCommitDate: useLastCommitDate && lastCommitByPullRequest[index].push.date
        }));

        // Format and print pull requests
        const longFormat = process.env.MESSAGE_FORMAT === "long";
        const pullRequestAttachments = pullRequests.map((pr, index) => {
            // Yellow when older than a day, red when older than a week.
            const dangerThreshold = process.env.PULL_REQUEST_AGE_DANGER || 7 * 24;
            const warningThreshold = process.env.PULL_REQUEST_AGE_WARNING || 24;

            const date = useLastCommitDate ? pr.lastCommitDate : pr.creationDate;
            const age = calculateAge(date, now);
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

            if (longFormat) {
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
            } else {
                return {
                    fallback: `${pr.title} by ${pr.author}`,
                    color: color,
                    title: pr.title,
                    title_link: pr.url,
                    text: `${pr.author} in \`${pr.repository}\``,
                    mrkdwn_in: ["text"]
                };
            }
        });

        if (pullRequestAttachments.length > 0) {
            if (!process.env.DRY_RUN) {
                try {
                    await webhook.send({
                        text: `Open pull requests in ${project}`,
                        attachments: pullRequestAttachments,
                    });
                } catch (error) {
                    context.log.error(error);
                }
            }

            context.log(`Reminded about ${pullRequestAttachments.length} pull requests in ${project}.`);
        } else {
            context.log(`No open pull requests in ${project}`);
        }

        // Load branches
        const repositories = await git.getRepositories(project);
        const branchRequests = repositories.map(repository =>
            git.getBranches(repository.id).catch(() => []));
        const branchesByRepository = await Promise.all(branchRequests);

        const allowRegex = new RegExp(`^${process.env.ALLOW_BRANCHES || ".*"}$`);
        const ignoreRegex = new RegExp(`^${process.env.IGNORE_BRANCHES || ""}$`);

        const forbiddenBranchesByRepository = branchesByRepository.map((branches, index) =>
            branches.filter(branch =>
                !(allowRegex.test(branch.name) || ignoreRegex.test(branch.name))));

        const forbiddenBranchInformation = [].concat.apply([],
            forbiddenBranchesByRepository.map((branches, index) => 
                branches.map(branch => ({
                    branch: branch.name,
                    repository: repositories[index].name
                }))
        ));

        const forbiddenBranchAttachments = forbiddenBranchInformation.map(info => ({
            text: `\`${info.branch}\` in \`${info.repository}\``,
            color: "danger",
            mrkdwn_in: ["text"]
        }));

        if (forbiddenBranchAttachments.length > 0) {
            if (!process.env.DRY_RUN) {
                try {
                    await webhook.send({
                        text: `Forbidden branches in ${project}`,
                        attachments: forbiddenBranchAttachments,
                    });
                } catch (error) {
                    context.log.error(error);
                }
            }

            context.log(`Reminded about ${forbiddenBranchAttachments.length} forbidden branches in ${project}.`);
        } else {
            context.log(`No forbidden branches in ${project}`);
        }

        const warningThreshold = process.env.BRANCH_AGE_WARNING || 7 * 24;
        const dangerThreshold = process.env.BRANCH_AGE_DANGER || 30 * 24;

        const inactiveBranchesByRepository = branchesByRepository.map((branches, index) =>
            branches.filter(branch =>
                allowRegex.test(branch.name) && !ignoreRegex.test(branch.name)
                && calculateAge(branch.commit.author.date, now) > warningThreshold
                && !pullRequests.some(pullRequest =>
                    pullRequest.repository === repositories[index].name
                    && pullRequest.source == branch.name)));
        
        const inactiveBranchInformation = [].concat.apply([],
            inactiveBranchesByRepository.map((branches, index) => 
                branches.map(branch => ({
                    branch: branch.name,
                    age: calculateAge(branch.commit.author.date, now),
                    repository: repositories[index].name
                }))
        ));

        const inactiveBranchAttachments = inactiveBranchInformation.map(info => ({
            text: `\`${info.branch}\` in \`${info.repository}\``,
            color: info.age > dangerThreshold ? "danger" : "warning",
            mrkdwn_in: ["text"]
        }));

        if (inactiveBranchAttachments.length > 0) {
            if (!process.env.DRY_RUN) {
                try {
                    await webhook.send({
                        text: `Inactive branches in ${project}`,
                        attachments: inactiveBranchAttachments,
                    });
                } catch (error) {
                    context.log.error(error);
                }
            }

            context.log(`Reminded about ${inactiveBranchAttachments.length} inactive branches in ${project}.`);
        } else {
            context.log(`No inactive branches in ${project}`);
        }
    }
};