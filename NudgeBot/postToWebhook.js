"use strict";

const postToWebhook = async function postToWebhook(context, webhook, project, items, attachments) {
    if (attachments.length > 0) {
        if (!process.env.DRY_RUN) {
            try {
                await webhook.send({
                    text: `${items.charAt(0).toUpperCase() + items.slice(1)} in ${project}`,
                    attachments: attachments,
                });
            } catch (error) {
                context.log.error(error);
            }
        }

        context.log(`Reminded about ${attachments.length} ${items} in ${project}.`);
    } else {
        context.log(`No ${items} in ${project}`);
    }
}

module.exports = postToWebhook;