# NudgeBot
NudgeBot posts a list of open pull requests from Azure DevOps to a Slack channel.

## Environment Variables
The following environment variables must be set to run NudgeBot.

### SLACK_INCOMING_WEBHOOK
The URL of a Slack incoming webhook which should be set up to post in an appropriate channel.
Visit https://my.slack.com/services/new/incoming-webhook to create a new incoming webhook or https://api.slack.com/incoming-webhooks to read more about incoming webhooks.

### AZURE_DEVOPS_ORGANIZATION and AZURE_DEVOPS_PROJECT
The organization and project parts of your https://dev.azure.com/organization/project URL.

### AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN
See https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats?view=vsts
