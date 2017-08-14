var Slack = require('slack-node');

webhookUri = process.env.WEBHOOK;

slack = new Slack();
slack.setWebhook(webhookUri);

// welcome message
function welcome() {
  slack.webhook({
    channel: "#general",
    username: "webhookbot",
    text: "This is posted to #general and comes from a bot named webhookbot."
  }, function(err, response) {
    console.log(response);
  });
}

// send message
function sendMsg(message) {
  slack.webhook({
    channel: "#general",
    username: "webhookbot",
    text: message
  }, function(err, response) {
    console.log(response);
  });
}

function sendMsg(message, url) {
  slack.setWebhook(url);
  slack.webhook({
    channel: "#general",
    username: "webhookbot",
    text: message
  }, function(err, response) {
    console.log(response);
  });
}

module.exports = {
  welcome,
  sendMsg
}
