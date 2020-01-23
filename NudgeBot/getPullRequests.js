"use strict";

const getPullRequests = async function getPullRequests(git, project) {
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

    return rawPullRequests.map((pr, index) => ({
        title: pr.title,
        reviewers: pr.reviewers.map(r =>
            r.uniqueName.includes("@")
                ? r.uniqueName.split("@")[0]
                : r.uniqueName.split("\\").slice(-1)[0]),
        repository: pr.repository.name,
        relativeUrl: `/${pr.repository.project.name}/_git/`
            + `${pr.repository.name}/pullrequest/${pr.pullRequestId}`,
        author: pr.createdBy.displayName,
        creationDate: new Date(pr.creationDate),
        source: pr.sourceRefName.replace(/^refs\/heads\//, ""),
        target: pr.targetRefName.replace(/^refs\/heads\//, ""),
        status: statuses[index],
        activeComments: activeComments[index],
        date: useLastCommitDate ? lastCommitByPullRequest[index].push.date : new Date(pr.creationDate)
    }));
};

module.exports = getPullRequests;