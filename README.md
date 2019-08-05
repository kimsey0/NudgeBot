# NudgeBot
NudgeBot posts a list of open pull requests and inactive branches from Azure DevOps to a Slack channel.

## Application Settings
The following application settings are supported.
When running on Azure, they should be set as Application settings for the Function Apps resource.
When running locally, they can be set as environment variables or under `Values` in `local.settings.json`.

### SLACK_INCOMING_WEBHOOK (required)
The URL of a Slack incoming webhook which should be set up to post in an appropriate channel.
Visit https://my.slack.com/services/new/incoming-webhook to create a new incoming webhook or https://api.slack.com/incoming-webhooks to read more about incoming webhooks.

### AZURE_DEVOPS_ORGANIZATION and AZURE_DEVOPS_PROJECT (required)
The organization and project parts of your https://dev.azure.com/organization/project URL.

`AZURE_DEVOPS_PROJECT` can optionally contain multiple project names separated by commas (`"project1,project2"`).
In that case, NudgeBot will post lists for each project.

### AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN (required)
See https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats?view=vsts

### MESSAGE_FORMAT
The format for messages about pull requests.
Set to `long` to include title, author, repository, source and target branch, status, number of unresolved comments, and creation time.
Set to `short` (default) to include only title, author and repository.

### PULL_REQUEST_AGE_WARNING and PULL_REQUEST_AGE_DANGER
The allowed age of pull requests in hours until they are marked with a warning color (orange, default 24 hours) or a danger color (red, default 168 hours).

### ALLOW_BRANCHES and IGNORE_BRANCHES
Set to regular expressions ([JavaScript syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)) matching the full branch name to determine which branches are allowed, which are ignored, and which are forbidden.
Allowed branches are posted if they are marked as inactive, ignored branches are never posted, and all other branches are always posted and marked as _forbidden_.
The default is that all branches are allowed (`.*`) and that no branches are ignored (` `).

As an example, to follow Gitflow-style naming, to require that all feature branches start with an issue number, a hyphen, and an uppercase letter, and to ignore inactivity for `develop` and `master`, set `ALLOW_BRANCHES` to `(feature/\\d+-[A-Z]|release/|hotfix/).*` and `IGNORE_BRANCHES` to `develop|master`.

### BRANCH_AGE_WARNING and BRANCH_AGE_DANGER
The allowed time since last commit was made to a branch in hours until it is marked with a warning color (orange, default 168 hours) or a danger color (red, default 720 hours).

### PULL_REQUEST_AGE_SINCE
Set to `commit` to measure pull request and commit age as time since last commit to the source branch.
Set to `creation` (default) to measure pull request and commit age as time since the pull request was created.

### BUSINESS_DAYS and BUSINESS_HOURS
Set to comma-separated lists of business days and hours to calculate the age of pull requests and commits in business hours.

Business days are specified as 0 for Sunday through 6 for Saturday.
As an example, `1,2,3,4,5` means Monday through Friday.

Business hours are specified in 24-hour format including the opening hour, but excluding the closing hour.
As an example, `9,10,11,12,13,14,15,16` means 9:00 to 17:00 (9 am to 5 pm).

(Remember to adjust `PULL_REQUEST_AGE_WARNING`, `PULL_REQUEST_AGE_DANGER0`, `BRANCH_AGE_WARNING`, and `BRANCH_AGE_DANGER` to account for the smaller number of business hours in a week.
When using business days, age limits above one month are not supported.)

### INCLUDE_DRAFT_PULL_REQUESTS
Set to any non-empty value to include draft pull requests in the list.
