# NudgeBot
NudgeBot posts a list of open pull requests from Azure DevOps to a Slack channel.

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
In that case, NudgeBot will post a list for each project.

### AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN (required)
See https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats?view=vsts

### MESSAGE_FORMAT
Set to `long` to include title, author, repository, source and target branch, status, number of unresolved comments, and creation time.
Set to `short` (default) to include only title, author and repository.

### PULL_REQUEST_AGE_SINCE
Set to `commit` to measure pull request age as time since last commit to the source branch.
Set to `creation` (default) to measure pull request age as time since the pull request was created.

In either case, the pull requests will be color coded as follows:
- Green, if less than 24 hours old
- Yellow, if between 24 hours and 7 days old
- Red, if more than 7 days ago old

### INCLUDE_DRAFT_PULL_REQUESTS
Set to any non-empty value to include draft pull requests in the list.
