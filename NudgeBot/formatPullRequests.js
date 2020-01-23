"use strict";

const calculateAge = require("./calculateAge");

const formatPullRequests = function formatPullRequests(pullRequests, now) {
    const longFormat = process.env.MESSAGE_FORMAT === "long";
    return pullRequests.map((pr, index) => {
        // Yellow when older than a day, red when older than a week.
        const dangerThreshold = process.env.PULL_REQUEST_AGE_DANGER || 7 * 24;
        const warningThreshold = process.env.PULL_REQUEST_AGE_WARNING || 24;
        
        const age = calculateAge(pr.date, now);
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
                title_link: `${orgUrl}${pr.relativeUrl}`,
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
};

module.exports = formatPullRequests;